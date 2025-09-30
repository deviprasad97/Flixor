# Backend Migration – Status, Gaps, and Next Phases

This document captures what we have migrated from a frontend‑only app to our backend, what is intentionally still handled on the frontend, and the concrete plan for the next phases. It reflects the current repo state and supersedes older integration notes for accuracy.

## Summary

- Backend (Express + TypeORM + SQLite + Cache) is running and provides TMDB proxy, Plex auth/session, Plex library/search/metadata APIs, image proxy, ratings (from Plex), and progress updates.
- Frontend delegates all Plex reads to the backend. The only direct calls to Plex from the browser are player streaming requests (by design, identical to commit 147b572).

Note: The frontend now uses the backend for Plex reads by default. The old `VITE_USE_BACKEND_PLEX` flag has been removed/ignored and can be deleted from `.env`.

## What’s Done (Backend + Frontend)

- Core server
  - Express server, sessions (connect‑typeorm), CORS/helmet/compression, logging.
  - DB (SQLite/TypeORM) with entities: users, user settings, sessions, cache entries.
- Caching
  - In‑memory buckets (plex/tmdb/trakt/image/general), stats, invalidation.
  - Middleware for response caching.
- TMDB proxy
  - Default/baked key + per‑user custom key support; rate limiting via queue; caching; usage stats.
- Plex auth/session
  - Plex PIN flow; user creation/update; session cookie.
  - Server sync: fetch Plex resources via account token, normalize/persist servers, set current server.
  - Sensitive token storage encrypted at rest.
- Plex APIs (reads)
  - Servers (list/set current), libraries, library contents (with pagination/filters), search (typed), metadata (+extras/external/children), on deck, continue watching, recent, directory proxy for library paths.
- Player integration
  - Streaming (unchanged from 147b572): The browser builds the Plex decision and stream URL client‑side using the same X‑Plex headers + profile and calls Plex directly for `decision` and `start.mpd/m3u8`. This preserves exact behavior and quality switching.
  - Progress updates: The browser posts to `/api/plex/progress` (backend relays to Plex `/:/timeline`) to keep session logic and cache invalidation server‑side.

## What’s Intentionally Parked (still frontend or not migrated yet)

- Streaming via backend proxy
  - We attempted proxying manifests/segments through `/api/plex/proxy/*` but auth + cookie handling for segment requests complicate it. We’ve reverted to direct Plex URLs to avoid regressions.
  - If we want to proxy, we should implement a signed ticket + manifest/segment rewrite so cookies are not required by the proxy.
- Audio/subtitle stream selection via backend
  - The player currently updates streams directly against Plex if needed. Backend wrappers for `PUT /library/parts/:id` can be added.
- Image usage
  - TMDB images: remain direct (allowed). Backend image proxy exists but not universally used.
  - Plex images: still built as `baseUrl + path + X‑Plex‑Token` on the client in many places; can be migrated to `/api/image/plex`.
- Residual direct Plex calls in some views
  - None for reads. All reads (libraries, metadata/extras/children, directories, search, GUID mapping, collections) go through backend now.
  - Aggregated lists (e.g., New & Popular’s recently added/popular) still call backend‑wrapped reads under the hood. We can add explicit aggregator endpoints later if needed.

## Frontend Backend Usage

- Plex reads are backend‑only by default across Home/Library/Search/Details.
- Player
  - Streaming: The frontend requests a stream URL via the backend, which returns a direct Plex URL (decision + `start.mpd/m3u8`). The player then loads that URL directly.
  - Progress: Player reports progress via backend (`/api/plex/progress`).
  - We no longer gate this behind `VITE_USE_BACKEND_PLEX`.

Ratings – IMDb and Rotten Tomatoes via Plex
- We no longer use OMDb. Ratings are sourced from Plex metadata:
  - Server items: `GET /api/plex/ratings/:ratingKey` returns IMDb (rating/votes) and Rotten Tomatoes (critic/audience) when available.
  - VOD/Discover items: `GET /api/plex/vod/ratings/:id` queries `vod.provider.plex.tv` with the user’s Plex account token.
- UI shows explicit IMDb, RT critic, and RT audience pills under the Details hero.

## Risks / Notes

- Streaming
  - Returning a direct Plex URL with token matches previous behavior and avoids cookie issues. It exposes the token in the network tab (same as before). A proxy path would hide this but needs ticketing/rewrites.
- Session + CORS
  - Proxy endpoints require cookies; DASH/HLS libraries need withCredentials settings. By returning direct URLs we remove this coupling.
- Progress updates
  - Now go through backend; align all timeline calls to that path for consistency.

## Database & Migrations (dev vs prod)

- DB location and creation
  - Default path: `backend/config/db/app.sqlite`.
  - Override via `CONFIG_DIRECTORY` (directory) or `DATABASE_PATH` (full file path).
  - The backend creates the directory and file on startup if missing, and enables WAL + foreign keys.
- Development (`npm run dev:all`)
  - `dev:all` runs `vite` and the backend watcher concurrently.
  - On backend start, the DB is initialized and migrations are run automatically by the server (no CLI needed). `synchronize` remains enabled in dev as a safety net until migrations exist for all entities.
- Production
  - In production, `synchronize` is disabled and migrations are run automatically at startup (`runMigrations`).
  - First-run bootstrap: if no core tables are found and no migrations are present on disk, the server performs a one-time `synchronize()` to create the schema. This enables out-of-the-box Docker deploys before formal migrations are added.
- Running migrations manually in development
  - Generate: `cd backend && npm run migration:generate -- src/db/migrations/<Name>`
  - Run: `cd backend && npm run migration:run`
  - Revert last: `cd backend && npm run migration:revert`
- Optional: force migrations on every dev start
  - Update the backend dev script to run migrations before starting the watcher, e.g. `"dev": "npm run migration:run && tsx watch src/server.ts"`.
  - If you adopt this, consider turning off `synchronize` in development to keep schema changes migration‑driven.

## Next Phase – Plan of Action

Phase 2 wrap (stabilization)
- Validate all read endpoints now that backend is the default path across Home/Library/Search/Details.
- Audit remaining direct Plex reads and swap to backend equivalents where missing.

De‑stale pass (completed)
- Frontend now delegates GUID lookups, libraries, directories, metadata, extras, children, collections, and search through backend.
- Removed stale/duplicated client helpers:
  - Deleted: `src/services/plex_player.ts`, `src/services/plex_stream.ts`, `src/services/plextv_auth.ts`.
  - Consolidated playback helpers into `src/services/plex.ts` (decision, stream URL, timeline, stop transcode, image transcode, part URL) while keeping behavior identical to 147b572.
  - Updated components to use backend services: Home, Library, Search, Details, BrowseModal, TraktSection, ContinueCard, LandscapeCard, and Player (metadata/progress).
  - Settings and TopNav use backend auth/server routes (`apiClient`) instead of direct Plex.tv helpers.

Phase 3 – Player hardening
- Progress + Scrobble
  - Confirm final scrobble and rating flows via backend from the player UI.
- Defer audio/subtitle endpoints for now (we kept streaming URLs frontend‑style; stream selection works fine client‑side and backend adds little value until a proxy path is adopted).

Phase 4 – Image proxy adoption (security + caching)
- Replace Plex image URLs in the UI with `/api/image/plex?path=...` so the backend derives server/token from the signed‑in user; no tokens in the browser.
- Keep TMDB direct unless optimization is needed.

What still intentionally calls Plex directly (for now)
- Playback (exactly as 147b572): Player requests `decision` and `start.mpd/m3u8` directly from Plex. This preserves quality selection/original behavior.
- Convenience links in Details (direct part stream; open in Plex) remain direct by design.

Done – Plex Discover watchlist via backend
- Added backend routes under `/api/plextv` to proxy Plex Discover:
  - `GET /api/plextv/watchlist`
  - `PUT /api/plextv/watchlist/:id`
  - `DELETE /api/plextv/watchlist/:id`
- Frontend `src/services/plextv.ts` now uses these endpoints with cookies; no tokens are sent from the browser.

Done – Plex collections via backend
- Added backend route: `GET /api/plex/library/:id/collections`
- Frontend switched to `plexBackendCollections(sectionKey)` for Search collections UI.

Reliability – Plex connection fallback (backend)
- Backend PlexClient now retries across candidates when a connection times out or fails:
  - Tries configured `protocol://host:port`, public address, and local addresses across https/http.
  - Switches to the first working base URL for subsequent calls.
  - In development, TLS is relaxed for plex.direct/self‑signed certificates (to avoid dev‑only failures).
  - This eliminates 30s timeouts on `/api/plex/metadata/:id` seen when a single advertised URI is unreachable.

Phase 5 – Optional: Proxy‑based streaming (tokenless)
- Design
  - Generate signed “ticket” per session/title; rewrite manifest/segment URLs to `/api/plex/proxy/*?ticket=...` and validate per request.
  - Ensure Range requests, Content‑Type, CORS, performance handled.
- HLS and DASH support; background testing before enabling flag.

Phase 6 – Security & QoL
- CSRF protection for state‑changing routes.
- Request validation (zod) for POST/PUT endpoints.
- Per‑route rate limiting.
- Observability: structured logs/events for player flows.

## Quick Reference – Key Files

- Server bootstrap: `backend/src/server.ts`
- DB config: `backend/src/db/data-source.ts`
- Entities: `backend/src/db/entities/*`
- Cache: `backend/src/services/cache/CacheManager.ts`
- TMDB proxy: `backend/src/api/tmdb.ts`, `backend/src/services/tmdb/TMDBClient.ts`
- Plex APIs: `backend/src/api/plex.ts`, `backend/src/services/plex/PlexClient.ts`
- Plex Discover proxy: `backend/src/api/plextv.ts`
- Auth/PIN: `backend/src/api/auth.ts`
- Image proxy: `backend/src/api/image-proxy.ts`
- Ratings (Plex server, VOD): `backend/src/api/plex.ts`
- Frontend backend clients: `src/services/plex_backend.ts`, `src/services/plex_backend_player.ts`
- Ratings service (frontend): `src/services/ratings.ts`
- Players: `src/components/AdvancedPlayer.tsx`, `src/components/PlexVideoPlayer.tsx`, `src/routes/Player.tsx`

## Testing Tips

- Health: `GET http://localhost:3001/health`
- Validate session: `GET http://localhost:3001/api/auth/session`
- TMDB proxy sample: `GET http://localhost:3001/api/tmdb/trending/tv/week`
- Plex reads: `GET http://localhost:3001/api/plex/libraries` (requires login + server sync)
- Player
  - Streaming URL: `GET /api/plex/stream/:ratingKey` (returns direct DASH URL)
  - Progress: `POST /api/plex/progress` with `{ ratingKey, time, duration, state }`

Plex Discover Watchlist
- `GET http://localhost:3001/api/plextv/watchlist`
- `PUT http://localhost:3001/api/plextv/watchlist/:id`
- `DELETE http://localhost:3001/api/plextv/watchlist/:id`

Collections
- `GET http://localhost:3001/api/plex/library/:id/collections`
