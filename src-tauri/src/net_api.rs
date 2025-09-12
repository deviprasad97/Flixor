use serde_json::Value;

#[tauri::command]
pub async fn tmdb_trending(media: String, window: String, bearer: String) -> Result<Value, String> {
  let url = format!("https://api.themoviedb.org/3/trending/{}/{}", media, window);
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Authorization", format!("Bearer {}", bearer))
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trakt_trending(kind: String, client_id: String) -> Result<Value, String> {
  let url = format!("https://api.trakt.tv/{}/trending", kind);
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("trakt-api-version", "2")
    .header("trakt-api-key", client_id)
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plex_sections(base_url: String, token: String) -> Result<Value, String> {
  let url = format!("{}/library/sections?X-Plex-Token={}", base_url.trim_end_matches('/'), token);
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plex_on_deck(base_url: String, token: String, library_key: String) -> Result<Value, String> {
  let url = format!("{}/library/sections/{}/onDeck?X-Plex-Token={}", base_url.trim_end_matches('/'), library_key, token);
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plex_on_deck_global(base_url: String, token: String) -> Result<Value, String> {
  let url = format!("{}/library/onDeck?X-Plex-Token={}", base_url.trim_end_matches('/'), token);
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plex_sections_all(base_url: String, token: String, section_key: String, params: Option<String>) -> Result<Value, String> {
  // params may include filters/sorts, e.g., "?type=1&sort=addedAt:desc"
  let qs = params.unwrap_or_else(|| String::from("?type=1&sort=addedAt:desc"));
  let url = format!(
    "{}/library/sections/{}/all{}{}X-Plex-Token={}",
    base_url.trim_end_matches('/'),
    section_key,
    if qs.starts_with('?') { "" } else { "?" },
    qs.trim_start_matches('?')
  , token);

  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plex_metadata(base_url: String, token: String, rating_key: String) -> Result<Value, String> {
  let url = format!(
    "{}/library/metadata/{}?X-Plex-Token={}",
    base_url.trim_end_matches('/'),
    rating_key,
    token
  );
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn plex_search(base_url: String, token: String, query: String, r#type: Option<String>) -> Result<Value, String> {
  let t = r#type.unwrap_or_else(|| "1".into()); // 1 movie, 2 show
  let url = format!(
    "{}/search?type={}&query={}{}{}",
    base_url.trim_end_matches('/'),
    t,
    urlencoding::encode(&query),
    if query.contains('?') { "&" } else { "&" },
    format!("X-Plex-Token={}", token)
  );
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plex_find_guid(base_url: String, token: String, guid: String, r#type: Option<String>) -> Result<Value, String> {
  // Attempts direct GUID lookup across library using /library/all with guid filter
  let mut url = format!(
    "{}/library/all?guid={}&X-Plex-Token={}",
    base_url.trim_end_matches('/'),
    urlencoding::encode(&guid),
    token
  );
  if let Some(t) = r#type { url.push_str(&format!("&type={}", t)); }
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plex_children(base_url: String, token: String, rating_key: String) -> Result<Value, String> {
  let url = format!(
    "{}/library/metadata/{}/children?X-Plex-Token={}",
    base_url.trim_end_matches('/'),
    rating_key,
    token
  );
  let client = reqwest::Client::new();
  let res = client
    .get(url)
    .header("Accept", "application/json")
    .send().await.map_err(|e| e.to_string())?;
  res.json::<Value>().await.map_err(|e| e.to_string())
}
