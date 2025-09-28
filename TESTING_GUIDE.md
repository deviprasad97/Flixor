# Testing Guide - Plex Media Player

## Overview
This guide covers testing procedures for the backend services implemented in Phase 1 and Phase 2.

## Prerequisites

1. **Ensure both servers are running:**
   ```bash
   # Terminal 1 - Backend (Port 3001)
   cd backend
   npm run dev

   # Terminal 2 - Frontend (Port 5173)
   cd /
   npm run dev
   ```

2. **Check services are up:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001/health

## Phase 1 Testing - Authentication & Session Management

### 1. Backend Health Check
```bash
# Test backend is running with all services
curl http://localhost:3001/health | jq .
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-...",
  "environment": "development",
  "database": "connected",
  "cache": {
    "buckets": 5,
    "totalKeys": 0
  }
}
```

### 2. Plex Authentication Flow

**Step 1: Navigate to Login**
1. Open http://localhost:5173
2. You should be redirected to `/login` if not authenticated

**Step 2: Sign in with Plex**
1. Click "Sign in with Plex" button
2. A popup window should open to `app.plex.tv/auth`
3. Sign in with your Plex account
4. Authorize the application
5. The popup should close automatically
6. You should be redirected to the home page

**Step 3: Verify Session**
```bash
# Check session status
curl -c cookies.txt http://localhost:3001/api/auth/session | jq .
```

**Expected Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "username": "your-username",
    "email": "your-email@example.com",
    ...
  }
}
```

### 3. User Profile Dropdown

**Test Steps:**
1. After login, hover over the user icon in the top-right navbar
2. A dropdown should appear with:
   - Your username
   - Your email
   - Account type (if Plex Pass)
   - Sign Out button

**Verify:**
- Profile image loads (if available)
- Hover animations work smoothly
- Click "Sign Out" logs you out

### 4. Server Selection

**Check available servers:**
```bash
curl -b cookies.txt http://localhost:3001/api/auth/servers | jq .
```

**Expected:** List of your Plex servers with connection details

## Phase 2 Testing - Caching Infrastructure

### 1. Cache Statistics

**Check cache stats:**
```bash
# Overall stats
curl http://localhost:3001/api/cache/stats | jq .

# Specific bucket
curl http://localhost:3001/api/cache/stats?bucket=tmdb | jq .
```

**Expected Response Structure:**
```json
{
  "buckets": 5,
  "totalKeys": 0,
  "totalHits": 0,
  "totalMisses": 0,
  "overallHitRate": 0,
  "totalMemoryUsage": 0,
  "details": [...]
}
```

### 2. Image Proxy Testing

**Test 1: Proxy External Image**
```bash
# First request (cache MISS)
curl -I "http://localhost:3001/api/image/proxy?url=https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg&w=300&h=450"

# Look for: X-Cache: MISS
```

```bash
# Second request (cache HIT)
curl -I "http://localhost:3001/api/image/proxy?url=https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg&w=300&h=450"

# Look for: X-Cache: HIT
```

**Test 2: Different Image Sizes**
```bash
# Thumbnail
curl -o thumb.jpg "http://localhost:3001/api/image/proxy?url=https://image.tmdb.org/t/p/original/1E5baAaEse26fej7uHcjOgEE2t2.jpg&w=200&h=300&q=75"

# Medium
curl -o medium.jpg "http://localhost:3001/api/image/proxy?url=https://image.tmdb.org/t/p/original/1E5baAaEse26fej7uHcjOgEE2t2.jpg&w=800&h=1200&q=85"

# Check file sizes
ls -lh *.jpg
```

**Test 3: Image Cache Stats**
```bash
curl http://localhost:3001/api/image/cache/stats | jq .
```

**Expected:** Shows cached files count and total size

### 3. Cache Management

**Test Cache Health:**
```bash
curl http://localhost:3001/api/cache/health | jq .
```

**Expected:**
```json
{
  "status": "healthy",
  "checks": {
    "set": true,
    "get": true,
    "delete": true
  },
  "timestamp": "..."
}
```

**List Cache Keys:**
```bash
# List keys in a bucket
curl "http://localhost:3001/api/cache/keys?bucket=tmdb&limit=10" | jq .
```

**Flush Cache (requires auth):**
```bash
# Flush specific bucket
curl -X POST -b cookies.txt "http://localhost:3001/api/cache/flush?bucket=tmdb" | jq .

# Flush all
curl -X POST -b cookies.txt "http://localhost:3001/api/cache/flush" | jq .
```

## Frontend Integration Testing

### 1. Home Page Content Loading

**Test Steps:**
1. Login and navigate to home page
2. Open browser DevTools > Network tab
3. Filter by "Fetch/XHR" requests
4. Refresh the page

**Verify:**
- TMDB API calls go through backend (if configured)
- Images load through proxy endpoint
- No direct calls to external APIs
- Session cookies are included in requests

### 2. Search Functionality

**Test Steps:**
1. Click search icon or press Cmd/Ctrl + K
2. Type a movie/show name
3. Observe network requests

**Verify:**
- Search results appear
- Images use proxy URLs
- Debouncing works (not every keystroke triggers search)

### 3. Image Optimization

**Test in DevTools:**
1. Open Network tab
2. Navigate through the app
3. Check image requests

**Verify:**
- Images requested with size parameters (w=, h=)
- Response headers show `X-Cache: HIT` on repeated views
- Images are optimized (smaller file sizes)

## Performance Testing

### 1. Cache Hit Rates

After browsing for a few minutes:
```bash
curl http://localhost:3001/api/cache/stats | jq '.overallHitRate'
```

**Target:** > 50% hit rate after initial browsing

### 2. Image Load Times

**Compare:**
1. First load: Note time for image request (MISS)
2. Second load: Should be significantly faster (HIT)
3. Check cached version serves in < 50ms

### 3. Session Persistence

**Test:**
1. Login to the app
2. Close browser completely
3. Reopen and navigate to http://localhost:5173
4. Should remain logged in (session cookie persists)

## Troubleshooting

### Common Issues

1. **"Cannot connect to backend"**
   - Check backend is running: `curl http://localhost:3001/health`
   - Check CORS settings if getting CORS errors
   - Verify frontend uses correct backend URL

2. **"Authentication fails"**
   - Check Plex OAuth headers in backend logs
   - Verify database tables exist: `ls backend/config/db/`
   - Try clearing cookies and re-authenticating

3. **"Images not loading"**
   - Check image proxy endpoint: `curl -I http://localhost:3001/api/image/proxy?url=<image-url>`
   - Verify cache directory exists: `ls backend/cache/images/`
   - Check Sharp installation: `cd backend && npm ls sharp`

4. **"Cache not working"**
   - Check cache stats endpoint
   - Verify NodeCache is initialized (check backend logs)
   - Try flushing cache and retesting

### Debug Commands

```bash
# View backend logs
tail -f backend/logs/app.log

# Check database
sqlite3 backend/config/db/app.sqlite ".tables"

# List cached images
ls -la backend/cache/images/

# Monitor cache hit/miss in real-time
watch -n 1 'curl -s http://localhost:3001/api/cache/stats | jq ".overallHitRate"'
```

## API Testing with Postman/Insomnia

Import this collection for API testing:

```json
{
  "info": {
    "name": "Plex Media Backend",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "Create Plex PIN",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/auth/plex/pin",
        "body": {
          "mode": "raw",
          "raw": "{}"
        }
      }
    },
    {
      "name": "Check Session",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/auth/session"
      }
    },
    {
      "name": "Cache Stats",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/cache/stats"
      }
    },
    {
      "name": "Proxy Image",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/api/image/proxy?url=https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg&w=300"
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001"
    }
  ]
}
```

## Success Criteria

✅ **Phase 1 - Authentication:**
- [ ] User can login with Plex OAuth
- [ ] Session persists across page refreshes
- [ ] User profile shows in navbar
- [ ] Logout works correctly
- [ ] Database stores user data

✅ **Phase 2 - Caching:**
- [ ] Cache statistics endpoint works
- [ ] Image proxy caches images to disk
- [ ] Cache hit/miss headers present
- [ ] Image optimization works (resize/quality)
- [ ] Cache management endpoints functional

## Next Steps

After successful testing:
1. Monitor cache hit rates over time
2. Optimize cache TTL values based on usage patterns
3. Implement cache warming for popular content
4. Add monitoring/alerting for cache performance
5. Consider CDN integration for static assets