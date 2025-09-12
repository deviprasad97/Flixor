use crate::player::{PlayerEngine, PlayerState};
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn player_open(app: AppHandle, state: State<'_, PlayerState>, url: String) -> Result<(), String> {
  state.engine().open(&app, &url).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn player_play(state: State<'_, PlayerState>) -> Result<(), String> {
  state.engine().play().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn player_pause(state: State<'_, PlayerState>) -> Result<(), String> {
  state.engine().pause().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn player_stop(state: State<'_, PlayerState>) -> Result<(), String> {
  state.engine().stop().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn player_seek(state: State<'_, PlayerState>, seconds: f64) -> Result<(), String> {
  state.engine().seek(seconds).await.map_err(|e| e.to_string())
}

