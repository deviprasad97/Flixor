[DON't WORRY about Windows for now]
---

# Super Prompt — **Plex Media Manager (Netflix-style) + MPV (static) + Cross-platform Bundling**

**You are** a senior cross-platform engineer (Rust + React/TS + build/release).
**Goal**: Ship a production Plex client with a Netflix-quality UI, embedded MPV playback, a recs/trending hub, and **statically built** media stack (FFmpeg, libmpv, libass, libplacebo) **bundled** inside the app for macOS, Windows, and Linux.

## 1) Architecture

* **Host:** Tauri v2 (Rust core + React/TS front-end).
* **Player:** **libmpv** embedded (primary) + JSON IPC fallback; one `PlayerEngine` interface.
* **UI:** React + Tailwind; Netflix-like: hero rows, carousels, continue-watching, faceted filters, gorgeous posters/backdrops, skeletons, and instant search.
* **Data:** Plex (auth, libraries, playstate), TMDB/Trakt for metadata/trending; cache with SQLite + image disk cache.

## 2) Static media stack (per-OS)

* **Target:** Build **static** mpv + FFmpeg + libass + libplacebo; avoid GPL/nonfree flags by default (LGPL-only playback), but allow a **profile** to enable GPL encoders when explicitly requested at build time.
* **Linux:** Use **mpv-build** to produce static mpv **with FFmpeg/libass/libplacebo**.

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

## 3) Bundling & permissions (Tauri)

* Treat mpv/ffmpeg as **managed sidecars**. In `src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "allowlist": { "shell": { "sidecar": true } },
    "bundle": {
      "externalBin": [
        "bin/mpv",
        "bin/ffmpeg",
        "bin/ffprobe"
      ]
    }
  }
}
```

* Name binaries per target triple in build scripts and copy the right one into `bin/` before packaging. Expose a Rust command to launch/control mpv (libmpv preferred; sidecar fallback uses JSON IPC).

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

* **CI:** GitHub Actions builds all targets; artifacts = DMG (macOS), MSI/EXE (Windows), AppImage + Flatpak manifest (Linux).
* **Code signing:** Windows `signtool`; macOS codesign + **notarize** (`notarytool`) + **staple**.
* **Licensing compliance (critical):**

  * Build mpv with `-Dgpl=false` for **LGPL** libmpv; keep FFmpeg **LGPL-only** unless explicitly enabling GPL/nonfree.
  * Because we **statically link**, provide **object files** or an equivalent relink path to satisfy **LGPL re-link** obligations; include licenses/attribution and offer source/package links in **About → Licenses**.
  * If GPL options are enabled, ensure app distribution is **GPL-compatible** or ship those bits as separate executables.

## 7) Tasks for you (the LLM)

1. Scaffold Tauri v2 + React/TS app, theming, routing, virtualization, skeletons.
2. Implement **libmpv** wrapper (Rust) + IPC fallback; expose Tauri commands/events.
3. Write **portable build scripts** to compile **static** FFmpeg/libass/libplacebo + mpv **per OS** (Linux via mpv-build; Windows via MSYS2/MinGW-w64; macOS via clang).
4. Copy platform artifacts into `bin/` and wire **sidecar** launch + control.
5. Implement Plex client (auth, library, playstate sync), TMDB/Trakt providers, recs pipeline.
6. Build Netflix-style UI (Home/Library/Details/Player) with test data; then live.
7. Package, codesign, **notarize**, and produce installers for all OSes, with CI.

**Non-goals:** DRM platforms (e.g., Netflix playback). Use TMDB/Trakt for metadata/trending only.

---

### References used (for you)

* mpv build & **static** helper scripts (produces static mpv + FFmpeg/libass/libplacebo). ([GitHub][1])
* mpv license: **LGPL build** with `-Dgpl=false`; libmpv notes. ([GitHub][2])
* FFmpeg licensing & LGPL checklist; Windows/macOS build notes. ([FFmpeg][3])
* **LGPL static linking** relink requirement (provide object files). ([GNU][4])
* Tauri **sidecar/externalBin** bundling. ([Tauri][5])
* macOS **notarization** (`notarytool`) & Windows **signtool**. ([Apple Developer][6])

---

[1]: https://github.com/mpv-player/mpv-build "GitHub - mpv-player/mpv-build:  Helper scripts to compile mpv on Linux"
[2]: https://github.com/mpv-player/mpv?utm_source=chatgpt.com "mpv-player/mpv: 🎥 Command line media player"
[3]: https://www.ffmpeg.org/legal.html?utm_source=chatgpt.com "FFmpeg License and Legal Considerations"
[4]: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html?utm_source=chatgpt.com "GNU Lesser General Public License, version 2.1"
[5]: https://v2.tauri.app/develop/sidecar/?utm_source=chatgpt.com "Embedding External Binaries"
[6]: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution?utm_source=chatgpt.com "Notarizing macOS software before distribution"

