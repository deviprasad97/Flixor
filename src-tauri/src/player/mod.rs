use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};

#[cfg(all(feature = "libmpv"))]
mod libmpv;
mod ipc;

#[derive(Clone)]
pub struct PlayerState(Arc<Mutex<Box<dyn PlayerEngine + Send + Sync>>>);

#[async_trait::async_trait]
pub trait PlayerEngine {
  fn name(&self) -> &'static str;
  async fn open(&self, app: &AppHandle, url: &str) -> anyhow::Result<()>;
  async fn play(&self) -> anyhow::Result<()>;
  async fn pause(&self) -> anyhow::Result<()>;
  async fn stop(&self) -> anyhow::Result<()>;
  async fn seek(&self, seconds: f64) -> anyhow::Result<()>;
}

impl PlayerState {
  pub fn new(engine: Box<dyn PlayerEngine + Send + Sync>) -> Self { Self(Arc::new(Mutex::new(engine))) }
  pub fn engine(&self) -> EngineGuard { EngineGuard(self.0.clone()) }
}

pub struct EngineGuard(Arc<Mutex<Box<dyn PlayerEngine + Send + Sync>>>);

impl EngineGuard {
  pub async fn open(&self, app: &AppHandle, url: &str) -> anyhow::Result<()> { self.0.lock().await.open(app, url).await }
  pub async fn play(&self) -> anyhow::Result<()> { self.0.lock().await.play().await }
  pub async fn pause(&self) -> anyhow::Result<()> { self.0.lock().await.pause().await }
  pub async fn stop(&self) -> anyhow::Result<()> { self.0.lock().await.stop().await }
  pub async fn seek(&self, seconds: f64) -> anyhow::Result<()> { self.0.lock().await.seek(seconds).await }
}

pub fn init_player_state(app: &AppHandle) -> anyhow::Result<()> {
  #[cfg(feature = "libmpv")]
  let engine: Box<dyn PlayerEngine + Send + Sync> = Box::new(libmpv::LibMpvEngine::new()?);
  #[cfg(not(feature = "libmpv"))]
  let engine: Box<dyn PlayerEngine + Send + Sync> = Box::new(ipc::IpcEngine::new());

  app.manage(PlayerState::new(engine));
  Ok(())
}
