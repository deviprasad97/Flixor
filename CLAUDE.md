# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web Plex media client built with React + TypeScript. It features Netflix-style UI with a web player (HLS.js/DASH.js) for media playback.

## Common Development Commands

### Frontend Development
```bash
npm run dev        # Start Vite dev server on port 5173
npm run build      # Build production frontend to dist/
npm run preview    # Preview production build
```

### Media
Playback is via browser (HLS.js/DASH.js). No native media stack is required.

## Architecture

### Tech Stack
- **Frontend**: React 18 with TypeScript, React Router for navigation
- **Styling**: Tailwind CSS with custom components
- **Player**: MPV integration via libmpv (when feature enabled) or IPC fallback
- **State Management**: React hooks and context
- **Build**: Vite for frontend bundling

### Project Structure

#### Frontend (`/src`)
- **routes/**: Page components (Home, Library, Details, Player, Settings, Login)
- **components/**: Reusable UI components (Netflix-style cards, carousels, modals)
- **services/**: API clients for Plex, TMDB, Trakt, and streaming
- **state/**: Application state management (settings, auth)

#### Backend
No desktop backend. The app talks directly to Plex/TMDB/Trakt over HTTPS.

### Key Architectural Patterns

1. **Web Player**: Single player path via HLS.js/DASH.js with Element Picture‑in‑Picture. 
2. **Path Aliases**: TypeScript uses path aliases (@/components, @/routes, @/services, @/state) configured in `tsconfig.json` and `vite.config.ts`.

## Important Implementation Notes

- The player system supports both embedded libmpv (when compiled with `--features libmpv`) and IPC-based control as fallback
- Frontend routes are client-side rendered with React Router
- Plex authentication flows through plex.tv OAuth
- Media metadata comes from both Plex servers and external sources (TMDB/Trakt)
- The app targets LGPL compliance by default (build with `-Dgpl=false` for mpv)
