# Plex Web Player Implementation Details

## Overview
This document details the implementation of a web-based Plex media player with advanced features including direct play/stream support, quality selection, and DASH/HLS streaming protocols.

## Architecture

### Core Components

1. **AdvancedPlayer.tsx** - Main player container and UI controls
   - Manages player state (play/pause, volume, quality, etc.)
   - Handles Plex metadata and streaming decisions
   - Implements custom video controls with Netflix-style UI
   - Manages timeline updates and session management

2. **PlexVideoPlayer.tsx** - Video playback engine wrapper
   - Abstracts HLS.js and DASH.js implementations
   - Handles stream initialization and cleanup
   - Manages video element lifecycle
   - Reports playback events to parent component

3. **plex_player.ts** - Plex-specific streaming APIs
   - Generates X-Plex headers for authentication
   - Implements Plex Universal Decision API
   - Manages transcode sessions
   - Handles stream URL generation with proper parameters

4. **plex_decision.ts** - Stream decision logic
   - Determines direct play/stream/transcode capabilities
   - Analyzes codec compatibility
   - Generates quality options from media metadata
   - Handles audio/subtitle stream selection

## Key Implementation Details

### 1. Protocol Selection (HLS vs DASH)

**Problem:** Initial implementation used HLS protocol which caused unnecessary transcoding of HEVC content.

**Solution:** Switched to DASH protocol to match Plex Web behavior:
```typescript
protocol: 'dash', // Use DASH like Plex Web for better codec support
```

**Why DASH?**
- Better codec support (especially HEVC/H.265)
- Enables direct streaming of HEVC through container remux
- More efficient adaptive bitrate streaming
- Standard protocol used by Plex Web

### 2. Streaming Decisions

The player makes intelligent decisions about how to stream content:

**Direct Play:** Browser plays the file directly without any server processing
- Requires browser-compatible container (MP4, WebM)
- Requires browser-compatible codecs (H.264, AAC)
- Most efficient - no server CPU usage

**Direct Stream:** Plex remuxes container while keeping codecs intact
- Used when container needs changing (MKV → MP4)
- Preserves original video quality
- Minimal server CPU usage
- Critical for HEVC content that can't be played directly

**Transcode:** Full video/audio conversion
- Used when codecs aren't compatible
- Allows quality selection (bitrate limiting)
- Higher server CPU usage

### 3. Plex Decision API Integration

Before streaming, we query Plex's decision API to determine the actual playback method:

```typescript
const plexDecision = await plexUniversalDecision(plexConfig, itemId, {
  maxVideoBitrate: quality === 'original' ? undefined : Number(quality),
  protocol: 'dash',
  directPlay: decision.directPlay,
  directStream: decision.directStream,
});
```

This returns:
- `canDirectPlay`: Whether direct play is possible
- `willTranscode`: Whether transcoding will occur
- `willDirectStream`: Whether direct streaming (remux) will occur

### 4. Session Management

**Problem:** Quality changes were creating multiple concurrent transcode jobs without cleanup.

**Solution:** Implemented proper session management:
1. Keep consistent session ID across quality changes
2. Call stop transcode endpoint before starting new streams
3. Reuse session for quality switches

```typescript
// Stop existing transcode session before starting new one
await plexKillAllTranscodeSessions(plexConfig);
```

### 5. Client Identification

The player identifies itself to Plex servers with proper headers:
- Product: "Flixor"
- Platform: "Web"
- Client ID: Persistent per browser
- Session ID: Persistent per playback session
- Client Profile: Declares codec capabilities

### 6. Quality Selection

Quality options are dynamically generated from media metadata:
- "Original" - Direct play/stream when possible
- Bitrate options - Various transcode qualities (20000, 12000, 10000, etc.)
- Smart defaults based on media resolution

### 7. DASH.js Configuration

```typescript
dash.updateSettings({
  streaming: {
    buffer: {
      bufferTimeAtTopQuality: 30,
      fastSwitchEnabled: true,
    },
    abr: {
      autoSwitchBitrate: {
        video: false, // Manual quality control
      },
    },
  },
});
```

## Lessons Learned

### 1. Protocol Matters
- HLS has limited codec support in browsers
- DASH enables more direct streaming scenarios
- Matching Plex Web's protocol choice is crucial for compatibility

### 2. HEVC Handling
- HEVC doesn't always require transcoding
- Container remux (direct stream) is often sufficient
- Browser HEVC support is improving but still limited

### 3. Session Lifecycle
- Plex tracks transcode sessions per client
- Proper cleanup prevents resource leaks
- Reusing sessions enables smoother quality switches

### 4. Decision API is Truth
- Don't guess what Plex will do - ask it
- The decision API provides authoritative playback methods
- Client capabilities affect server decisions

### 5. Debug Information
- Console logging was essential during development
- Stream URLs can be tested directly in browser
- Plex decision responses provide valuable debugging info

## Common Issues and Solutions

### Issue: HEVC Content Transcoding Unnecessarily
**Cause:** Using HLS protocol which doesn't support HEVC direct stream
**Solution:** Switch to DASH protocol

### Issue: Multiple Transcode Jobs
**Cause:** Creating new sessions for each quality change
**Solution:** Implement proper session cleanup and reuse

### Issue: Quality Selection Not Working
**Cause:**
1. Not destroying previous player instances
2. Session management issues
3. Incorrect bitrate parameter types

**Solution:**
1. Force player remount with key prop
2. Stop transcode before new stream
3. Ensure bitrate is Number type

### Issue: Direct Play Not Working
**Cause:** Missing or incorrect client capabilities
**Solution:** Properly declare supported codecs in X-Plex-Client-Profile-Extra

## Performance Optimizations

1. **Buffering Strategy**
   - 30 seconds buffer at top quality
   - Fast switching enabled for quality changes
   - Aggressive buffer pruning to prevent memory issues

2. **Session Reuse**
   - Keep same session ID for quality changes
   - Reduces server overhead
   - Faster quality switching

3. **Player Cleanup**
   - Properly destroy HLS/DASH instances
   - Clear video element on unmount
   - Prevent memory leaks

## Future Improvements

1. **Subtitle Support**
   - External subtitle file support
   - Subtitle burn-in for incompatible formats
   - Subtitle timing adjustment

2. **Audio Stream Selection**
   - Multiple audio track support
   - Language preference persistence
   - Audio passthrough capabilities

3. **Advanced Features**
   - Chapter markers
   - Skip intro/credits
   - Playback speed persistence
   - Resume across devices

4. **Performance**
   - Preload next episode
   - Bandwidth adaptation
   - CDN optimization

## Testing Checklist

- [ ] Direct play works for compatible files
- [ ] Direct stream works for HEVC in MKV containers
- [ ] Quality selection changes stream immediately
- [ ] No orphaned transcode sessions
- [ ] Timeline updates sent to Plex
- [ ] Resume playback works
- [ ] Keyboard shortcuts functional
- [ ] Player controls auto-hide
- [ ] Fullscreen works properly
- [ ] Volume persists across sessions

## References

- [Plex Media Server HTTP API](https://github.com/Arcanemagus/plex-api/wiki)
- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
- [DASH.js Documentation](https://github.com/Dash-Industry-Forum/dash.js)
- [Plex Web Client (for reference implementation)](https://app.plex.tv)