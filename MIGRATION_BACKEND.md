# Backend Migration – Status, Gaps, and Next Phases

This document captures what we have migrated from a frontend‑only app to our backend, what is intentionally still handled on the frontend, and the concrete plan for the next phases. It reflects the current repo state (flag‑gated migration) and supersedes older integration notes for accuracy.

## Summary

- Backend (Express + TypeORM + SQLite + Cache) is running and provides TMDB proxy, Plex auth/session, Plex library/search/metadata APIs, image proxy, and progress updates.
- Frontend has a feature flag to switch Plex reads and player progress to the backend while keeping streaming behavior identical to the previous frontend (direct DASH URL with X‑Plex params + token).

Flag for dev: `VITE_USE_BACKEND_PLEX=true` (now set by default in `.env`).

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
- Player integration (partial)
  - Streaming URL: Backend returns a DASH `.mpd` universal start URL that mirrors the legacy frontend URL shape (protocol=dash, directStream=1, manifestSubtitles=1, X‑Plex‑* headers as query params, X‑Plex‑Token appended). Frontend uses this direct URL; no backend proxy in the playback path.
  - Progress updates: Frontend posts to `/api/plex/progress` (maps to Plex `/:/timeline` with correct params and ms units). Cache invalidation fixed (uses `cacheManager.del`).

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
  - Most reads now use backend under the flag; remaining edge calls (e.g., play queue or certain details flows) can be swapped to backend helpers as needed.
  - Aggregated lists (e.g., New & Popular’s cross‑library recently added/popular) still use frontend helpers that fan out to Plex; consider backend aggregator endpoints later.

## Current Dev Toggle

- `VITE_USE_BACKEND_PLEX` (true/false)
  - true: Frontend uses backend for Plex reads and player progress; playback URL is fetched from backend but points directly to Plex (same shape as legacy frontend).
  - false: Frontend uses previous direct Plex reads and direct player URLs.

## Risks / Notes

- Streaming
  - Returning a direct Plex URL with token matches previous behavior and avoids cookie issues. It exposes the token in the network tab (same as before). A proxy path would hide this but needs ticketing/rewrites.
- Session + CORS
  - Proxy endpoints require cookies; DASH/HLS libraries need withCredentials settings. By returning direct URLs we remove this coupling.
- Progress updates
  - Now go through backend; align all timeline calls to that path for consistency.

## Next Phase – Plan of Action

Phase 2 wrap (stabilization)
- Validate all read endpoints under `VITE_USE_BACKEND_PLEX=true` across Home/Library/Search/Details.
- Audit remaining direct Plex reads and swap to backend equivalents where missing.

Phase 3 – Player hardening
- Progress + Scrobble
  - Confirm final scrobble and rating flows via backend from the player UI.
- Defer audio/subtitle endpoints for now (we kept streaming URLs frontend‑style; stream selection works fine client‑side and backend adds little value until a proxy path is adopted).

Phase 4 – Image proxy adoption (security + caching)
- Replace Plex image URLs in the UI with `/api/image/plex?path=...` so the backend derives server/token from the signed‑in user; no tokens in the browser.
- Keep TMDB direct unless optimization is needed.

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
- Auth/PIN: `backend/src/api/auth.ts`
- Image proxy: `backend/src/api/image-proxy.ts`
- Frontend backend clients: `src/services/plex_backend.ts`, `src/services/plex_backend_player.ts`
- Players: `src/components/AdvancedPlayer.tsx`, `src/components/PlexVideoPlayer.tsx`, `src/routes/Player.tsx`

## Testing Tips

- Health: `GET http://localhost:3001/health`
- Validate session: `GET http://localhost:3001/api/auth/session`
- TMDB proxy sample: `GET http://localhost:3001/api/tmdb/trending/tv/week`
- Plex reads: `GET http://localhost:3001/api/plex/libraries` (requires login + server sync)
- Player
  - Streaming URL: `GET /api/plex/stream/:ratingKey` (returns direct DASH URL)
  - Progress: `POST /api/plex/progress` with `{ ratingKey, time, duration, state }`
