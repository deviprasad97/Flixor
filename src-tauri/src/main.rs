#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod player;
mod tauri_cmds;
mod net_api;
mod trakt_api;

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
      // Player commands
      tauri_cmds::player_open,
      tauri_cmds::player_play,
      tauri_cmds::player_pause,
      tauri_cmds::player_stop,
      tauri_cmds::player_seek,

      // TMDB API
      net_api::tmdb_trending,

      // Plex API
      net_api::plex_tv_pin_create,
      net_api::plex_tv_pin_poll,
      net_api::plex_tv_resources,
      net_api::plex_check_identity,
      net_api::plex_sections,
      net_api::plex_on_deck,
      net_api::plex_on_deck_global,
      net_api::plex_sections_all,
      net_api::plex_metadata,
      net_api::plex_search,
      net_api::plex_find_guid,
      net_api::plex_children,

      // Trakt API - Basic
      net_api::trakt_trending,
      trakt_api::trakt_popular,
      trakt_api::trakt_search,

      // Trakt API - Authentication
      trakt_api::trakt_device_code,
      trakt_api::trakt_poll_token,
      trakt_api::trakt_refresh_token,
      trakt_api::trakt_revoke_token,

      // Trakt API - User
      trakt_api::trakt_user_profile,
      trakt_api::trakt_user_settings,

      // Trakt API - Scrobbling
      trakt_api::trakt_scrobble_start,
      trakt_api::trakt_scrobble_pause,
      trakt_api::trakt_scrobble_stop,

      // Trakt API - History
      trakt_api::trakt_history,
      trakt_api::trakt_history_add,
      trakt_api::trakt_history_remove,

      // Trakt API - Watchlist
      trakt_api::trakt_watchlist,
      trakt_api::trakt_watchlist_add,
      trakt_api::trakt_watchlist_remove,

      // Trakt API - Progress & Recommendations
      trakt_api::trakt_progress,
      trakt_api::trakt_recommendations
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
