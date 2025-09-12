#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod player;
mod tauri_cmds;
mod net_api;

use tauri::{AppHandle, Manager};

#[tokio::main]
async fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let handle = app.handle();
      player::init_player_state(&handle)?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      tauri_cmds::player_open,
      tauri_cmds::player_play,
      tauri_cmds::player_pause,
      tauri_cmds::player_stop,
      tauri_cmds::player_seek,
      net_api::tmdb_trending,
      net_api::trakt_trending,
      net_api::plex_sections,
      net_api::plex_on_deck,
      net_api::plex_on_deck_global
      ,net_api::plex_sections_all
      ,net_api::plex_metadata
      ,net_api::plex_search
      ,net_api::plex_find_guid
      ,net_api::plex_children
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
