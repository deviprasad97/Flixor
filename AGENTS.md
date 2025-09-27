[DON't WORRY about Windows for now]
---

# Super Prompt — **Plex Media Manager (Netflix-style) – Web**

**You are** a senior frontend engineer (React/TS + web player).
**Goal**: Ship a production web Plex client with a Netflix-quality UI, embedded web playback, a recs/trending hub, and smooth UX.

## 1) Architecture

* **Host:** Web (Vite + React/TS).
* **Player:** Web player (HLS.js/DASH.js) with Element Picture‑in‑Picture.
* **UI:** React + Tailwind; Netflix-like: hero rows, carousels, continue-watching, faceted filters, gorgeous posters/backdrops, skeletons, and instant search.
* **Data:** Plex (auth, libraries, playstate), TMDB/Trakt for metadata/trending; cache with SQLite + image disk cache.

## 2) Media stack (web)

* **Target:** Stream via Plex (DASH/HLS) using DASH.js/HLS.js.

  * `git clone https://github.com/mpv-player/mpv-build && cd mpv-build`
  * `echo "-Dgpl=false" > mpv_options` (LGPL build, libmpv on)
  * (Optional encoders later via `ffmpeg_options`.)
  * `./rebuild -j$(nproc)`
  * Output: statically linked `mpv` + `libmpv.a/.so` (use as **sidecar** or link per target).
* **Windows (MSYS2/MinGW-w64) [DON't WORRY about this for now]:**

  * Build static FFmpeg (use `--pkg-config-flags="--static"`, `--enable-static --disable-shared`; avoid `--enable-gpl/--enable-nonfree` by default).
  * Build mpv/libmpv against that toolchain; produce **static or mostly-static** artifacts; bundle runtime DLLs only if unavoidable.
* **macOS (clang):**

  * Build static FFmpeg + libass + libplacebo; build mpv/libmpv with `-Dgpl=false`. Prefer **fully self-contained** artifacts; where full static isn’t feasible, embed `.dylib`/frameworks inside the `.app` and fix rpaths.
* **Outputs to bundle:** `mpv` (or `libmpv`), `ffmpeg/ffprobe` (static), required data files (fonts), and shaders.

## 3) Hosting

* Pure web app; deploy static assets to any CDN/host.

## 4) Netflix-grade UX (deliverables)

* **Home:** Continue Watching, On Deck, Because You Watched, Trending (TMDB/Trakt), Recently Added, Collections.
* **Details:** hero backdrop, cast grid, version/track picker, badges (4K/HDR/Atmos), related rows, “because you watched” explainers.
* **Library:** ultra-fast virtualized grid; filters (type/genre/year/resolution/HDR/audio); smart search with debounce.
* **Player:** minimal chrome w/ auto-hide, chapters thumbnails, quick settings (tone-mapping, speed, audio/subs).
* **Settings:** Plex login, API keys, MPV profiles (DirectPlay/Transcode), HDR→SDR tone-map, cache paths, telemetry opt-out.

## 5) Recommendations & Trending

* Hybrid: content-based (genres/keywords/cast vectors) + popularity (TMDB/Trakt) + session context (“next in series/franchise”).
* Deterministic re-rank; show **why** a title was recommended.

## 6) Release engineering (prod)

* **CI:** Build and deploy static site artifacts.

## 7) Tasks for you (the LLM)

1. Scaffold React/TS app, theming, routing, virtualization, skeletons.
2. Implement Plex client (auth, library, playstate sync), TMDB/Trakt providers, recs pipeline.
3. Build Netflix-style UI (Home/Library/Details/Player) with test data; then live.
4. Deploy as a static web app.

**Non-goals:** DRM platforms (e.g., Netflix playback). Use TMDB/Trakt for metadata/trending only.

---

### References used (for you)

* mpv build & **static** helper scripts (produces static mpv + FFmpeg/libass/libplacebo). ([GitHub][1])
* mpv license: **LGPL build** with `-Dgpl=false`; libmpv notes. ([GitHub][2])
* FFmpeg licensing & LGPL checklist; Windows/macOS build notes. ([FFmpeg][3])
* **LGPL static linking** relink requirement (provide object files). ([GNU][4])
* Web player libs (HLS.js/DASH.js)

---

[1]: https://github.com/mpv-player/mpv-build "GitHub - mpv-player/mpv-build:  Helper scripts to compile mpv on Linux"
[2]: https://github.com/mpv-player/mpv?utm_source=chatgpt.com "mpv-player/mpv: 🎥 Command line media player"
[3]: https://www.ffmpeg.org/legal.html?utm_source=chatgpt.com "FFmpeg License and Legal Considerations"
[4]: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html?utm_source=chatgpt.com "GNU Lesser General Public License, version 2.1"
