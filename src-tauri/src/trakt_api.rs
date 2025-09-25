use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_url: String,
    pub expires_in: i64,
    pub interval: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub refresh_token: String,
    pub scope: String,
    pub created_at: i64,
}

fn trakt_headers(token: Option<&str>, client_id: Option<&str>) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("trakt-api-version", HeaderValue::from_static("2"));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    if let Some(client_id) = client_id {
        headers.insert("trakt-api-key", HeaderValue::from_str(client_id).unwrap());
    }

    if let Some(token) = token {
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", token)).unwrap());
    }

    headers
}

#[tauri::command]
pub async fn trakt_device_code(client_id: String) -> Result<DeviceCode, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/oauth/device/code")
        .headers(trakt_headers(None, None))
        .json(&json!({
            "client_id": client_id
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get device code: {}", res.status()));
    }

    res.json::<DeviceCode>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_poll_token(device_code: String, client_id: String, client_secret: String) -> Result<Option<TokenResponse>, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/oauth/device/token")
        .headers(trakt_headers(None, None))
        .json(&json!({
            "code": device_code,
            "client_id": client_id,
            "client_secret": client_secret
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().as_u16() == 400 {
        // Still pending
        return Ok(None);
    }

    if !res.status().is_success() {
        return Err(format!("Failed to poll token: {}", res.status()));
    }

    res.json::<TokenResponse>().await.map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_refresh_token(refresh_token: String, client_id: String, client_secret: String) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/oauth/token")
        .headers(trakt_headers(None, None))
        .json(&json!({
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to refresh token: {}", res.status()));
    }

    res.json::<TokenResponse>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_revoke_token(access_token: String, client_id: String, client_secret: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/oauth/revoke")
        .headers(trakt_headers(None, None))
        .json(&json!({
            "token": access_token,
            "client_id": client_id,
            "client_secret": client_secret
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to revoke token: {}", res.status()));
    }

    Ok(())
}

#[tauri::command]
pub async fn trakt_user_profile(access_token: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.trakt.tv/users/me")
        .headers(trakt_headers(Some(&access_token), None))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get user profile: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_user_settings(access_token: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.trakt.tv/users/settings")
        .headers(trakt_headers(Some(&access_token), None))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get user settings: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_scrobble_start(access_token: String, item: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/scrobble/start")
        .headers(trakt_headers(Some(&access_token), None))
        .json(&item)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to start scrobble: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_scrobble_pause(access_token: String, item: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/scrobble/pause")
        .headers(trakt_headers(Some(&access_token), None))
        .json(&item)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to pause scrobble: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_scrobble_stop(access_token: String, item: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/scrobble/stop")
        .headers(trakt_headers(Some(&access_token), None))
        .json(&item)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to stop scrobble: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_history(access_token: String, r#type: Option<String>, limit: Option<i32>) -> Result<Value, String> {
    let mut url = "https://api.trakt.tv/users/me/history".to_string();
    if let Some(t) = r#type {
        url.push_str(&format!("/{}", t));
    }
    if let Some(l) = limit {
        url.push_str(&format!("?limit={}", l));
    }

    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .headers(trakt_headers(Some(&access_token), None))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get history: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_history_add(access_token: String, items: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/sync/history")
        .headers(trakt_headers(Some(&access_token), None))
        .json(&items)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to add to history: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_history_remove(access_token: String, items: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/sync/history/remove")
        .headers(trakt_headers(Some(&access_token), None))
        .json(&items)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to remove from history: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_watchlist(access_token: String, r#type: Option<String>) -> Result<Value, String> {
    let mut url = "https://api.trakt.tv/users/me/watchlist".to_string();
    if let Some(t) = r#type {
        url.push_str(&format!("/{}", t));
    }

    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .headers(trakt_headers(Some(&access_token), None))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get watchlist: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_watchlist_add(access_token: String, items: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/sync/watchlist")
        .headers(trakt_headers(Some(&access_token), None))
        .json(&items)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to add to watchlist: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_watchlist_remove(access_token: String, items: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trakt.tv/sync/watchlist/remove")
        .headers(trakt_headers(Some(&access_token), None))
        .json(&items)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to remove from watchlist: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_progress(access_token: String, r#type: String, sort: Option<String>) -> Result<Value, String> {
    let mut url = format!("https://api.trakt.tv/users/me/watched/{}/progress", r#type);
    if let Some(s) = sort {
        url.push_str(&format!("?sort={}", s));
    }

    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .headers(trakt_headers(Some(&access_token), None))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get progress: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_recommendations(access_token: String, r#type: String, limit: Option<i32>) -> Result<Value, String> {
    let mut url = format!("https://api.trakt.tv/recommendations/{}", r#type);
    if let Some(l) = limit {
        url.push_str(&format!("?limit={}", l));
    }

    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .headers(trakt_headers(Some(&access_token), None))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get recommendations: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_search(query: String, r#type: Option<String>, limit: Option<i32>, client_id: String) -> Result<Value, String> {
    let search_type = r#type.unwrap_or_else(|| "movie,show".to_string());
    let mut url = format!("https://api.trakt.tv/search/{}?query={}", search_type, urlencoding::encode(&query));
    if let Some(l) = limit {
        url.push_str(&format!("&limit={}", l));
    }

    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .headers(trakt_headers(None, Some(&client_id)))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to search: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_popular(r#type: String, client_id: String, limit: Option<i32>) -> Result<Value, String> {
    let mut url = format!("https://api.trakt.tv/{}/popular", r#type);
    if let Some(l) = limit {
        url.push_str(&format!("?limit={}", l));
    }

    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .headers(trakt_headers(None, Some(&client_id)))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Failed to get popular: {}", res.status()));
    }

    res.json::<Value>().await.map_err(|e| e.to_string())
}