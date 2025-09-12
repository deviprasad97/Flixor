use std::{path::PathBuf, process::Stdio, time::Duration};
use anyhow::Context;
use serde_json::json;
use tauri::{AppHandle, Manager};
use tokio::{io::AsyncWriteExt, process::Command, time::sleep};

use super::PlayerEngine;

pub struct IpcEngine {
  socket_path: tokio::sync::Mutex<Option<PathBuf>>,
}

impl IpcEngine {
  pub fn new() -> Self { Self { socket_path: tokio::sync::Mutex::new(None) } }
  fn resolve_sidecar(app: &AppHandle, name: &str) -> PathBuf {
    // In prod, binaries are placed in app resources under `bin/` by Tauri externalBin.
    if let Ok(resource_dir) = app.path().resource_dir() {
      let p = resource_dir.join(name);
      if p.exists() { return p; }
      let p = resource_dir.join("bin").join(name);
      if p.exists() { return p; }
    }
    // Dev fallback: src-tauri/bin
    let dev = app
      .path()
      .resolve("../src-tauri/bin", tauri::path::BaseDirectory::Resource)
      .unwrap_or_else(|_| PathBuf::from("src-tauri/bin"));
    dev.join(name)
  }

  #[cfg(unix)]
  async fn send_json(&self, val: serde_json::Value) -> anyhow::Result<()> {
    use tokio::net::UnixStream;
    let path = self.socket_path.lock().await.clone().context("mpv IPC socket not set")?;
    let mut stream = UnixStream::connect(path).await.context("connect mpv socket")?;
    let s = serde_json::to_string(&val)? + "\n";
    stream.write_all(s.as_bytes()).await?;
    Ok(())
  }

  #[cfg(windows)]
  async fn send_json(&self, _val: serde_json::Value) -> anyhow::Result<()> {
    // TODO: implement named pipe on Windows
    anyhow::bail!("mpv JSON IPC not implemented on Windows yet");
  }
}

#[async_trait::async_trait]
impl PlayerEngine for IpcEngine {
  fn name(&self) -> &'static str { "mpv-ipc" }

  async fn open(&self, app: &AppHandle, url: &str) -> anyhow::Result<()> {
    #[cfg(unix)]
    let sock = {
      let mut p = std::env::temp_dir();
      p.push(format!("mpv-{}.sock", uuid::Uuid::new_v4()));
      p
    };
    #[cfg(windows)]
    let sock = PathBuf::from(format!("\\\\.\\pipe\\mpv-{}", uuid::Uuid::new_v4()));

    // Keep a reference on self
    let path = sock.clone();
    let mpv_path = Self::resolve_sidecar(app, if cfg!(target_os = "windows") { "mpv.exe" } else { "mpv" });
    let mut cmd = Command::new(mpv_path);
    cmd.arg("--idle=yes")
      .arg("--force-window=yes")
      .arg("--pause=no")
      .arg("--msg-level=all=v")
      .arg(format!("--input-ipc-server={}", path.display()))
      .arg(url)
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null());

    let _child = cmd.spawn().context("spawn mpv sidecar")?;
    // Small delay to let socket be ready
    sleep(Duration::from_millis(250)).await;

    // Store socket path
    // SAFETY: self is behind &self; we don't mutate. In a real impl, engine would be behind Mutex for stateful update.
    *self.socket_path.lock().await = Some(sock);

    Ok(())
  }

  async fn play(&self) -> anyhow::Result<()> {
    self.send_json(json!({"command":["set_property","pause", false]})).await
  }

  async fn pause(&self) -> anyhow::Result<()> {
    self.send_json(json!({"command":["set_property","pause", true]})).await
  }

  async fn stop(&self) -> anyhow::Result<()> {
    self.send_json(json!({"command":["quit"]})).await
  }

  async fn seek(&self, seconds: f64) -> anyhow::Result<()> {
    self.send_json(json!({"command":["seek", seconds, "absolute"]})).await
  }
}
