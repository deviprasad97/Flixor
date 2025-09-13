# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-platform Plex media client built with Tauri v2 (Rust backend) and React + TypeScript (frontend). It features Netflix-style UI with MPV player integration for media playback.

## Common Development Commands

### Frontend Development
```bash
npm run dev        # Start Vite dev server on port 5173
npm run build      # Build production frontend to dist/
npm run preview    # Preview production build
```

### Rust/Tauri Development
```bash
cd src-tauri
cargo build              # Build Rust backend
cargo build --release    # Build optimized release
tauri dev               # Run full app in development mode
tauri build             # Build production app bundles
```

### Platform-specific Media Stack Building
```bash
# macOS
./scripts/build_media_macos.sh

# Linux  
./scripts/build_media_linux.sh

# Windows
./scripts/build_media_windows.sh
```

## Architecture

### Tech Stack
- **Backend**: Tauri v2 with Rust, using Tokio for async runtime
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

#### Backend (`/src-tauri`)
- **player/**: MPV player abstraction with trait-based engine system
  - `PlayerEngine` trait allows swapping between libmpv and IPC implementations
- **tauri_cmds.rs**: Tauri command handlers for frontend-backend communication
- **net_api.rs**: Network API handlers for Plex, TMDB, and Trakt

### Key Architectural Patterns

1. **Player Abstraction**: The `PlayerEngine` trait in `src-tauri/src/player/mod.rs` provides a unified interface for different player backends (libmpv or IPC), managed through `PlayerState` with async mutex protection.

2. **Tauri Commands**: All frontend-backend communication goes through Tauri's invoke system. Commands are defined in `src-tauri/src/tauri_cmds.rs` and `src-tauri/src/net_api.rs`.

3. **Path Aliases**: TypeScript uses path aliases (@/components, @/routes, @/services, @/state) configured in both `tsconfig.json` and `vite.config.ts`.

4. **Sidecar Binaries**: External binaries (mpv, ffmpeg, ffprobe) are bundled as sidecars, configured in `src-tauri/tauri.conf.json` under `bundle.externalBin`.

## Important Implementation Notes

- The player system supports both embedded libmpv (when compiled with `--features libmpv`) and IPC-based control as fallback
- Frontend routes are client-side rendered with React Router
- Plex authentication flows through plex.tv OAuth
- Media metadata comes from both Plex servers and external sources (TMDB/Trakt)
- The app targets LGPL compliance by default (build with `-Dgpl=false` for mpv)