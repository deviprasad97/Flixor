# Backend Migration Plan - Plex Media Player

## Overview
This document outlines the phased migration from a client-side only React application to a full-stack application with Express backend, SQLite database, and comprehensive caching layer.

## Architecture Goals
- **Security**: Move API keys and sensitive data to server-side
- **Performance**: Implement multi-layer caching (memory + disk)
- **Scalability**: Enable session persistence and multi-user support
- **Reliability**: Add rate limiting and error handling
- **Features**: Enable server-side features (scheduled tasks, analytics)

---

## Phase 1: Backend Foundation (Week 1)
**Goal**: Establish core backend infrastructure with database and session management

### 1.1 Project Setup
- [ ] Initialize backend directory structure
- [ ] Setup TypeScript configuration for backend
- [ ] Configure Express server with middleware
- [ ] Setup development scripts (nodemon/tsx watch)
- [ ] Configure environment variables (.env files)

### 1.2 Database Setup
- [ ] Install and configure TypeORM with SQLite
- [ ] Create database entities:
  - User (id, plexId, username, email, thumb, plexToken)
  - Session (id, userId, data, expiresAt)
  - UserSettings (userId, plexServers, tmdbApiKey, preferences)
  - CacheEntry (key, value, ttl, createdAt)
- [ ] Setup migrations system
- [ ] Enable WAL mode for SQLite
- [ ] Create database connection manager

### 1.3 Session Management
- [ ] Install express-session with connect-typeorm
- [ ] Configure session middleware
- [ ] Setup HTTPOnly cookies
- [ ] Implement CSRF protection
- [ ] Create session validation middleware

### 1.4 Basic Auth Endpoints
```typescript
POST /api/auth/plex          // Plex OAuth flow
GET  /api/auth/session       // Get current session
POST /api/auth/logout        // Logout
GET  /api/auth/validate      // Validate session
```

### Deliverables
- Running Express server on port 3001
- SQLite database with schema
- Working session management
- Basic authentication flow

---

## Phase 2: Caching Infrastructure (Week 2)
**Goal**: Implement multi-layer caching system for API responses and images

### 2.1 Cache Manager Setup
- [ ] Implement NodeCache for in-memory caching
- [ ] Create cache bucket manager
- [ ] Setup cache statistics collection
- [ ] Implement cache key generation strategy
- [ ] Add cache invalidation logic

### 2.2 API Response Caching
- [ ] Create cache configuration per service:
  ```typescript
  PlexCache: {
    metadata: 3600s,
    search: 300s,
    libraries: 86400s,
    ondeck: 60s
  }
  TMDBCache: {
    trending: 3600s,
    details: 86400s,
    search: 1800s
  }
  ```
- [ ] Implement cache middleware
- [ ] Add cache headers to responses
- [ ] Setup cache warming strategies

### 2.3 Image Proxy & Caching
- [ ] Create image proxy endpoints
- [ ] Implement disk-based image cache
- [ ] Add image optimization (resize, format conversion)
- [ ] Setup stale-while-revalidate strategy
- [ ] Implement background cleanup job

### 2.4 Cache Management API
```typescript
GET  /api/cache/stats        // Cache statistics
POST /api/cache/flush        // Flush specific cache
GET  /api/cache/keys         // List cache keys
```

### Deliverables
- Working in-memory cache system
- Image proxy with disk caching
- Cache management endpoints
- Performance metrics

---

## Phase 3: TMDB Integration (Week 3)
**Goal**: Proxy TMDB API with default key and custom key support

### 3.1 TMDB Service Setup
- [ ] Create TMDB client with default API key
- [ ] Implement rate limiting (default vs custom keys)
- [ ] Setup request queuing
- [ ] Add error handling and retry logic

### 3.2 Default API Key Implementation
- [ ] Bake in default key: `db55323b8d3e4154498498a75642b381`
- [ ] Implement conservative rate limits (2 req/sec)
- [ ] Setup longer cache TTLs for shared key
- [ ] Add usage tracking for default key

### 3.3 Custom API Key Support
- [ ] Add UI for API key management
- [ ] Implement key validation endpoint
- [ ] Create per-user TMDB clients
- [ ] Setup higher rate limits for custom keys
- [ ] Track per-user usage statistics

### 3.4 TMDB Proxy Endpoints
```typescript
GET /api/tmdb/trending/:type/:window
GET /api/tmdb/search/:type
GET /api/tmdb/movie/:id
GET /api/tmdb/tv/:id
GET /api/tmdb/person/:id
GET /api/tmdb/discover/:type
```

### Deliverables
- TMDB proxy with default key
- Custom key management UI
- Usage tracking dashboard
- Rate limit handling

---

## Phase 4: Plex Integration (Week 4)
**Goal**: Proxy all Plex API calls through backend

### 4.1 Plex Service Setup
- [ ] Create Plex API client wrapper
- [ ] Implement per-server connection management
- [ ] Add Plex token encryption in database
- [ ] Setup request signing and headers

### 4.2 Plex Authentication
- [ ] Implement Plex OAuth flow
- [ ] Store and manage Plex tokens securely
- [ ] Handle multiple Plex servers
- [ ] Implement server switching logic

### 4.3 Plex API Proxying
```typescript
GET  /api/plex/libraries
GET  /api/plex/library/:id/all
GET  /api/plex/metadata/:id
GET  /api/plex/search
GET  /api/plex/ondeck
GET  /api/plex/continue
POST /api/plex/scrobble
POST /api/plex/rate
```

### 4.4 Plex Media Streaming
- [ ] Implement transcoding decision API
- [ ] Create streaming URL generator
- [ ] Add bandwidth detection
- [ ] Setup quality selection logic

### Deliverables
- Complete Plex API proxy
- Secure token management
- Multi-server support
- Streaming optimization

---

## Phase 5: Frontend Migration (Week 5-6)
**Goal**: Migrate frontend to use backend APIs

### 5.1 API Client Creation
- [ ] Create unified backend API client
- [ ] Implement request interceptors
- [ ] Add token refresh logic
- [ ] Setup error handling

### 5.2 Service Layer Migration
- [ ] Replace direct Plex calls with backend API
- [ ] Replace direct TMDB calls with backend API
- [ ] Migrate from localStorage to session storage
- [ ] Update authentication flow

### 5.3 State Management Updates
- [ ] Remove client-side API keys
- [ ] Update settings management
- [ ] Migrate user preferences
- [ ] Update cache strategies

### 5.4 UI Updates
- [ ] Add loading states for backend calls
- [ ] Implement error boundaries
- [ ] Update settings page
- [ ] Add API usage dashboard

### Deliverables
- Fully migrated frontend
- No client-side API keys
- Improved error handling
- Usage statistics UI

---

## Phase 6: Advanced Features (Week 7)
**Goal**: Add enhanced backend capabilities

### 6.1 User Features
- [ ] Implement watchlist synchronization
- [ ] Add viewing history tracking
- [ ] Create recommendation engine
- [ ] Setup user preferences sync

### 6.2 Background Jobs
- [ ] Library sync scheduler
- [ ] Cache warming jobs
- [ ] Cleanup tasks
- [ ] Usage report generation

### 6.3 Analytics & Monitoring
```typescript
GET /api/admin/stats/usage
GET /api/admin/stats/performance
GET /api/admin/stats/errors
GET /api/admin/users
```

### 6.4 Advanced Caching
- [ ] Implement Redis support (optional)
- [ ] Add CDN integration
- [ ] Setup edge caching
- [ ] Implement predictive caching

### Deliverables
- Background job system
- Analytics dashboard
- Advanced caching strategies
- User activity tracking

---

## Phase 7: Production Deployment (Week 8)
**Goal**: Prepare for production deployment

### 7.1 Docker Setup
- [ ] Create multi-stage Dockerfile
- [ ] Setup Docker Compose for development
- [ ] Configure volume mounts
- [ ] Add health checks

### 7.2 Performance Optimization
- [ ] Implement compression
- [ ] Setup CDN for static assets
- [ ] Add database indexing
- [ ] Optimize cache strategies

### 7.3 Security Hardening
- [ ] Implement rate limiting per endpoint
- [ ] Add request validation
- [ ] Setup security headers
- [ ] Implement API versioning

### 7.4 Monitoring & Logging
- [ ] Setup structured logging
- [ ] Add APM integration
- [ ] Configure error tracking
- [ ] Setup uptime monitoring

### Deliverables
- Production-ready Docker image
- Deployment documentation
- Monitoring dashboards
- Security audit report

---

## Phase 8: Migration & Rollout (Week 9)
**Goal**: Smooth migration for existing users

### 8.1 Data Migration
- [ ] Import existing localStorage data
- [ ] Migrate user preferences
- [ ] Transfer watch history
- [ ] Preserve custom settings

### 8.2 Backward Compatibility
- [ ] Implement feature flags
- [ ] Add fallback mechanisms
- [ ] Create migration guides
- [ ] Setup rollback procedures

### 8.3 Testing & QA
- [ ] Unit tests for backend services
- [ ] Integration tests for API endpoints
- [ ] E2E tests for critical flows
- [ ] Performance testing

### 8.4 Documentation
- [ ] API documentation
- [ ] Deployment guide
- [ ] User migration guide
- [ ] Troubleshooting guide

### Deliverables
- Migration scripts
- Test coverage reports
- Documentation suite
- Rollback procedures

---

## Technical Stack Summary

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: SQLite with TypeORM
- **Session**: express-session + connect-typeorm
- **Cache**: NodeCache (memory) + File system (images)
- **HTTP Client**: Axios with rate limiting

### Configuration
```env
# Server
PORT=3001
NODE_ENV=production
SESSION_SECRET=<generated>

# Database
DATABASE_PATH=./config/db/app.sqlite

# Cache
CACHE_DIR=./config/cache
IMAGE_CACHE_DIR=./config/cache/images

# API Keys (server-side only)
TMDB_DEFAULT_KEY=db55323b8d3e4154498498a75642b381

# Paths
CONFIG_DIRECTORY=./config
LOG_DIRECTORY=./logs
```

### Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "express-session": "^1.17.0",
    "typeorm": "^0.3.0",
    "sqlite3": "^5.1.0",
    "connect-typeorm": "^2.0.0",
    "axios": "^1.6.0",
    "node-cache": "^5.1.0",
    "express-rate-limit": "^7.0.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.0",
    "dotenv": "^16.0.0",
    "winston": "^3.11.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "nodemon": "^3.0.0"
  }
}
```

---

## Success Metrics

### Performance
- [ ] API response time < 200ms (cached)
- [ ] API response time < 1s (uncached)
- [ ] Cache hit rate > 60%
- [ ] Image load time < 500ms

### Reliability
- [ ] Uptime > 99.9%
- [ ] Error rate < 0.1%
- [ ] Session persistence working
- [ ] Graceful degradation on failures

### Security
- [ ] No API keys in client code
- [ ] All sensitive data encrypted
- [ ] Rate limiting effective
- [ ] CSRF protection active

### User Experience
- [ ] Faster content loading
- [ ] Persistent sessions
- [ ] Better error messages
- [ ] Usage transparency

---

## Risk Mitigation

### Technical Risks
1. **Database Performance**
   - Mitigation: Use WAL mode, add indexes, implement connection pooling

2. **Rate Limiting**
   - Mitigation: Implement queuing, use multiple API keys, aggressive caching

3. **Migration Complexity**
   - Mitigation: Feature flags, gradual rollout, fallback mechanisms

### Operational Risks
1. **Increased Infrastructure**
   - Mitigation: Docker containers, automated deployment, monitoring

2. **Data Loss**
   - Mitigation: Regular backups, data validation, rollback procedures

---

## Timeline Summary

- **Weeks 1-2**: Backend infrastructure (Database, Sessions, Caching)
- **Weeks 3-4**: API integrations (TMDB, Plex proxying)
- **Weeks 5-6**: Frontend migration
- **Week 7**: Advanced features
- **Week 8**: Production preparation
- **Week 9**: Migration and rollout

Total Duration: **9 weeks**

---

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Weekly progress reviews
5. Adjust timeline as needed

---

*Document Version: 1.0*
*Last Updated: 2024*
*Status: PENDING APPROVAL*