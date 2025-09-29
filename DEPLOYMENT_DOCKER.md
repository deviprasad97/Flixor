# Production Deployment (Docker)

This repo includes Docker files to build and run the production frontend (static Vite build + Nginx) and backend (Node/Express + SQLite) with docker-compose.

## Quick Start

Requirements
- Docker 24+
- Docker Compose v2

Commands
- Build images: `docker compose build`
- Start services: `docker compose up -d`
- Stop services: `docker compose down`

Default ports
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

Note: The frontend now defaults its API base to same-origin `/api` in production (src/services/api.ts). The Nginx config proxies `/api` to the backend service, so no CORS is needed. In Vite dev (port 5173), it defaults to `http://localhost:3001/api`.

## Service Details

Backend (plex-media-backend)
- Image built from `backend/Dockerfile` (node:20-slim)
- Exposes port 3001
- Environment
  - `NODE_ENV=production`
  - `HOST=0.0.0.0`
  - `PORT=3001`
  - `FRONTEND_URL=http://localhost:8080` (CORS origin; set to your actual site URL in production)
  - `SESSION_SECRET=change-me-in-prod` (override in production)
  - Optional:
    - `CONFIG_DIRECTORY=/app/config`
    - `DATABASE_PATH=/app/config/db/app.sqlite`
    - `IMAGE_CACHE_DIR=/app/cache/images`
- Volumes
  - `backend-config:/app/config` (persists SQLite and config)
  - `backend-cache:/app/cache` (persists image cache)
- Migrations
  - The server runs TypeORM migrations automatically at startup (dev and prod). If none exist, it’s a no-op.

Frontend (Vite static + Nginx)
- Image built from `docker/frontend.Dockerfile`
- Serves built assets via Nginx with SPA fallback
- Exposes port 80 (published as 8080 in compose)
- Proxies `/api` to the backend (`backend:3001`) for same-origin cookies

## Customizing for Production

- Domain and CORS
  - Backend CORS remains configured, but with same-origin proxy, browsers won’t need CORS.
  - If serving on HTTPS, cookies are set with `SameSite=None; Secure`. Otherwise, first-party same-origin cookies work with `SameSite=Lax`.

- Secrets
  - Set a strong `SESSION_SECRET` environment variable.

- Volumes and Backups
  - Persist `/app/config` for SQLite: the DB file lives at `/app/config/db/app.sqlite` unless overridden.
  - Persist `/app/cache` for image cache and adjust cleanup policies as needed.

- TLS/Proxy
  - Terminate TLS at your proxy or use an ingress in Kubernetes; Nginx here is for static assets only.

## Useful Commands

- Check health: `curl http://localhost:3001/health`
- Tail logs: `docker compose logs -f backend` and `docker compose logs -f frontend`
- Rebuild after changes: `docker compose build --no-cache && docker compose up -d`

## Files

- `backend/Dockerfile`: Backend build/runtime
- `docker/frontend.Dockerfile`: Frontend build/runtime
- `docker/nginx.conf`: SPA Nginx config
- `docker-compose.yml`: Orchestration for both services

## Notes

- The frontend expects the backend at `http://localhost:3001` out of the box. If you plan to deploy under a different host or same-origin path, consider updating `src/services/api.ts` to derive the base URL from an environment variable (e.g., `VITE_API_BASE`) or use a relative path.
