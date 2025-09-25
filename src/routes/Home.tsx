import Billboard from '@/components/Billboard';
import HomeHero from '@/components/HomeHero';
import Row from '@/components/Row';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSettings, saveSettings } from '@/state/settings';
import { tmdbTrending, tmdbImage, tmdbVideos, tmdbImages, tmdbDetails } from '@/services/tmdb';
import { traktTrending, isTraktAuthenticated } from '@/services/trakt';
import { plexOnDeckGlobal, plexImage, plexLibs, plexSectionAll, plexMetadataWithExtras, plexPartUrl, plexLibrarySecondary, plexDir } from '@/services/plex';
import BrowseModal from '@/components/BrowseModal';
import { plexTvWatchlist } from '@/services/plextv';
import { createPin, pollPin, getResources, buildAuthUrl, pickBestConnection } from '@/services/plextv_auth';
import SectionBanner from '@/components/SectionBanner';
import { TraktSection } from '@/components/TraktSection';

type Item = { id: string; title: string; image?: string; subtitle?: string; badge?: string };

export default function Home() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ title: string; items: Item[]; variant?: 'default'|'continue' }>>([]);
  const [needsPlex, setNeedsPlex] = useState(false);
  const [hero, setHero] = useState<{ title: string; overview?: string; poster?: string; backdrop?: string; rating?: string; videoUrl?: string; ytKey?: string; id?: string; year?: string; runtime?: number; genres?: string[]; logoUrl?: string } | null>(null);
  const genreRows: Array<{label: string; type: 'movie'|'show'; genre: string}> = [
    { label: 'TV Shows - Children', type: 'show', genre: 'Children' },
    { label: 'Movie - Music', type: 'movie', genre: 'Music' },
    { label: 'Movies - Documentary', type: 'movie', genre: 'Documentary' },
    { label: 'Movies - History', type: 'movie', genre: 'History' },
    { label: 'TV Shows - Reality', type: 'show', genre: 'Reality' },
    { label: 'Movies - Drama', type: 'movie', genre: 'Drama' },
    { label: 'TV Shows - Suspense', type: 'show', genre: 'Suspense' },
    { label: 'Movies - Animation', type: 'movie', genre: 'Animation' },
  ];

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return; // prevent StrictMode double-run flicker
    didInit.current = true;
    const s = loadSettings();
    if (!s.plexBaseUrl && !s.plexToken && !s.plexAccountToken) {
      nav('/login');
      return;
    }
    // Auto Plex sign-in if no server configured
    (async () => {
      if (!s.plexBaseUrl && !s.plexToken && !s.plexAccountToken) {
        try {
          const cid = s.plexClientId || crypto.randomUUID();
          saveSettings({ plexClientId: cid });
          const pin:any = await createPin(cid);
          window.open(buildAuthUrl(cid, pin.code), '_blank');
          const start = Date.now();
          let authed: string | undefined;
          while (Date.now() - start < 120000) {
            const res:any = await pollPin(cid, pin.id);
            if (res?.authToken) { authed = res.authToken; break; }
            await new Promise(r => setTimeout(r, 3000));
          }
          if (authed) {
            saveSettings({ plexAccountToken: authed });
            const resources:any = await getResources(authed, cid);
            const servers = (resources || []).filter((r:any)=> r.product === 'Plex Media Server');
            if (servers.length) {
              const best = pickBestConnection(servers[0]);
              if (best) saveSettings({ plexServer: { name: servers[0].name, clientIdentifier: servers[0].clientIdentifier, baseUrl: best.uri, token: best.token }, plexBaseUrl: best.uri, plexToken: best.token });
            }
          }
        } catch {}
      }
    })();
    async function run() {
      try {
        const rowsData: Array<{ title: string; items: Item[]; variant?: 'default'|'continue' }> = [];
        let tmdbHero: any | null = null;
        let plexHero: any | null = null;
        let heroLogoUrl: string | undefined = undefined;
        if (s.tmdbBearer) {
          const tmdb = await tmdbTrending(s.tmdbBearer, 'tv', 'week');
          const items: Item[] = (tmdb as any).results?.slice(0, 16).map((r: any) => ({
            id: `tmdb:tv:${String(r.id)}`,
            title: r.name || r.title,
            image: tmdbImage(r.backdrop_path, 'w780') || tmdbImage(r.poster_path, 'w500'),
          })) || [];
          rowsData.push({ title: 'Popular on Netflix', items: items.slice(0, 8) });
          rowsData.push({ title: 'Trending Now', items: items.slice(8, 16) });
          // Prepare TMDB fallback hero (do not set yet)
          try {
            if ((tmdb as any).results?.length) {
              const f = (tmdb as any).results[0];
              let ytKey: string | undefined;
              try { const vids: any = await tmdbVideos(s.tmdbBearer!, 'tv', String(f.id)); ytKey = (vids.results||[]).find((v:any)=>v.site==='YouTube')?.key; } catch {}

              // Get additional details for the hero
              let genres: string[] = [];
              let year: string | undefined;
              let runtime: number | undefined;
              try {
                const details: any = await tmdbDetails(s.tmdbBearer!, 'tv', String(f.id));
                genres = (details.genres || []).map((g: any) => g.name);
                year = (details.first_air_date || '').slice(0, 4);
                runtime = details.episode_run_time?.[0];
              } catch {}

              tmdbHero = {
                title: f.name||f.title,
                overview: f.overview,
                poster: tmdbImage(f.poster_path,'w500')||undefined,
                backdrop: tmdbImage(f.backdrop_path,'w1280')||undefined,
                rating: undefined,
                ytKey,
                id: `tmdb:tv:${String(f.id)}`,
                genres,
                year,
                runtime
              };
              try {
                const imgs: any = await tmdbImages(s.tmdbBearer!, 'tv', String(f.id), 'en,null');
                const logo = (imgs?.logos||[]).find((l:any)=>l.iso_639_1==='en') || (imgs?.logos||[])[0];
                if (logo?.file_path) heroLogoUrl = tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original');
              } catch {}
            }
          } catch {}
        } else {
          // Fallback placeholders (no TMDB key)
          const landscape = Array.from({ length: 16 }).map((_, i) => ({ id: 'ph'+i, title: `Sample ${i+1}`, image: `https://picsum.photos/seed/land${i}/800/400` }));
          rowsData.push({ title: 'Popular on Netflix', items: landscape.slice(0, 8) });
          rowsData.push({ title: 'Trending Now', items: landscape.slice(8, 16) });
        }
        // Trakt content will be handled by TraktSection components below
        // Continue Watching via Plex On Deck if configured
        if (s.plexBaseUrl && s.plexToken) {
          try {
            const deck: any = await plexOnDeckGlobal({ baseUrl: s.plexBaseUrl, token: s.plexToken });
            const meta = deck?.MediaContainer?.Metadata || [];
            const items: any[] = meta.slice(0, 10).map((m: any, i: number) => {
              const img = plexImage(s.plexBaseUrl!, s.plexToken!, m.thumb || m.parentThumb || m.grandparentThumb || m.art);
              const duration = (m.duration || 0) / 1000;
              const vo = (m.viewOffset || 0) / 1000;
              const progress = duration > 0 ? Math.min(100, Math.max(1, Math.round((vo / duration) * 100))) : 0;
              return { id: `plex:${String(m.ratingKey || i)}`, title: m.title || m.grandparentTitle || 'Continue', image: img, progress };
            });
            rowsData.splice(1, 0, { title: 'Continue Watching', items: items as any, variant: 'continue' });
          } catch (e) {
            setNeedsPlex(true);
          }
          // Watchlist via Plex.tv if configured
          if (s.plexTvToken) {
            try {
              const wl: any = await plexTvWatchlist(s.plexTvToken);
              const meta = wl?.MediaContainer?.Metadata || [];
              const wlItems: Item[] = meta.slice(0, 12).map((m: any, i: number) => ({
                id: inferIdFromGuid(m) || `guid:${encodeURIComponent(m.guid||'')}`,
                title: m.title || m.grandparentTitle || 'Title',
                image: m.thumb || m.parentThumb || m.grandparentThumb,
              }));
              const row: any = { title: 'Watchlist', items: wlItems };
              row.browseKey = '/plextv/watchlist';
              rowsData.push(row);
            } catch {}
          }
          // Genre-based rows from first matching library containing that genre
          try {
            const libs: any = await plexLibs({ baseUrl: s.plexBaseUrl!, token: s.plexToken! });
            const dirs = libs?.MediaContainer?.Directory || [];
            for (const gr of genreRows) {
              const lib = dirs.find((d: any) => d.type === (gr.type === 'movie' ? 'movie' : 'show'));
              if (!lib) continue;
              try {
                const gens: any = await plexLibrarySecondary({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, String(lib.key), 'genre');
                const gx = (gens?.MediaContainer?.Directory || []).find((g: any) => String(g.title).toLowerCase() === gr.genre.toLowerCase());
                if (!gx) continue;
                const path = `/library/sections/${lib.key}/genre/${gx.key}`;
                const data: any = await plexDir({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, path);
                const meta = data?.MediaContainer?.Metadata || [];
                const items: Item[] = meta.slice(0, 12).map((m: any) => ({ id: `plex:${m.ratingKey}`, title: m.title || m.grandparentTitle || 'Title', image: plexImage(s.plexBaseUrl!, s.plexToken!, m.thumb || m.parentThumb || m.grandparentThumb || m.art) }));
                const row: any = { title: gr.label, items };
                row.browseKey = path;
                rowsData.push(row);
              } catch {}
            }
          } catch {}
          // Try to build a Plex-based hero like Nevu
          try {
            const libs: any = await plexLibs({ baseUrl: s.plexBaseUrl!, token: s.plexToken! });
            const dirs = libs?.MediaContainer?.Directory || [];
            const elig = dirs.filter((d: any) => d.type === 'movie' || d.type === 'show');
            for (let attempts = 0; attempts < 8; attempts++) {
              const lib = elig[Math.floor(Math.random() * Math.max(1, elig.length))];
              if (!lib) break;
              const t = lib.type === 'movie' ? 1 : 2;
              const q = `?type=${t}&sort=random:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=1`;
              const res: any = await plexSectionAll({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, String(lib.key), q);
              const m = res?.MediaContainer?.Metadata?.[0];
              if (!m) continue;
              const meta: any = await plexMetadataWithExtras({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, String(m.ratingKey));
              const mm = meta?.MediaContainer?.Metadata?.[0];
              if (!mm) continue;
              const poster = plexImage(s.plexBaseUrl!, s.plexToken!, mm.thumb || mm.parentThumb || mm.grandparentThumb);
              const backdrop = plexImage(s.plexBaseUrl!, s.plexToken!, mm.art || mm.parentThumb || mm.grandparentThumb || mm.thumb);
              const extra = mm?.Extras?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key as string | undefined;
              const videoUrl = extra ? plexPartUrl(s.plexBaseUrl!, s.plexToken!, extra) : undefined;

              // Extract metadata for hero
              const genres = (mm.Genre || []).map((g: any) => g.tag);
              const year = mm.year ? String(mm.year) : undefined;
              const runtime = mm.duration ? Math.round(mm.duration / 60000) : undefined;

              plexHero = {
                title: mm.title || mm.grandparentTitle || 'Title',
                overview: mm.summary,
                poster,
                backdrop,
                rating: mm.contentRating || undefined,
                videoUrl,
                id: `plex:${String(mm.ratingKey)}`,
                genres,
                year,
                runtime
              };
              // If this item has a TMDB GUID, try TMDB logo and dispatch
              try {
                const tmdbGuid = (mm.Guid || []).map((g:any)=>String(g.id||''))
                  .find((g:string)=>g.includes('tmdb://')||g.includes('themoviedb://'));
                if (tmdbGuid && s.tmdbBearer) {
                  const tid = tmdbGuid.split('://')[1];
                  const mediaType = (mm.type === 'movie') ? 'movie' : 'tv';
                  const imgs: any = await tmdbImages(s.tmdbBearer!, mediaType as any, tid, 'en,null');
                  const logo = (imgs?.logos||[]).find((l:any)=>l.iso_639_1==='en') || (imgs?.logos||[])[0];
                  if (logo?.file_path) heroLogoUrl = tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original');
                }
              } catch {}
              break;
            }
          } catch (e) { /* ignore */ }
        } else {
          setNeedsPlex(true);
        }
        setRows(rowsData);
        // Commit hero once with final choice (prefer Plex)
        const finalHero = plexHero || tmdbHero;
        if (!hero && finalHero) {
          // Add logo URL to hero data
          if (heroLogoUrl) {
            finalHero.logoUrl = heroLogoUrl;
          }
          setHero(finalHero);
          if (heroLogoUrl) window.dispatchEvent(new CustomEvent('home-hero-logo', { detail: { logoUrl: heroLogoUrl } }));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, []);

  // Refresh entire app when server changes
  useEffect(() => {
    const handler = () => window.location.reload();
    // @ts-ignore - CustomEvent typing
    window.addEventListener('plex-server-changed', handler as any);
    return () => {
      // @ts-ignore - CustomEvent typing
      window.removeEventListener('plex-server-changed', handler as any);
    };
  }, []);

  return (
    <div className="pb-10">
      {/* Spacer to separate hero from transparent nav */}
      <div className="pt-24" />
      {hero ? (
        <HomeHero
          title={hero.title}
          overview={hero.overview}
          posterUrl={hero.poster}
          backdropUrl={hero.backdrop}
          rating={hero.rating}
          year={hero.year}
          runtime={hero.runtime}
          genres={hero.genres}
          logoUrl={hero.logoUrl}
          videoUrl={hero.videoUrl}
          ytKey={hero.ytKey}
          onPlay={() => { if (hero.id) nav(`/player/${encodeURIComponent(hero.id)}`); }}
          onMoreInfo={() => { if (hero.id) nav(`/details/${encodeURIComponent(hero.id)}`); }}
        />
      ) : (
        <div className="bleed" style={{ padding: '20px' }}>
          <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-neutral-900/40 h-[56vh] md:h-[64vh] xl:h-[68vh] skeleton" />
        </div>
      )}
      <div className="mt-6" />
      {needsPlex && (
        <SectionBanner title="Continue Watching" message="Connect your Plex account to see your in‑progress shows and movies here." cta="Open Settings" to="/settings" />
      )}
      {!loading && rows.map((r: any) => (
        <Row key={r.title} title={r.title} items={r.items as any} variant={r.variant} browseKey={r.browseKey} onItemClick={(id) => nav(`/details/${encodeURIComponent(id)}`)} />
      ))}

      {/* Trakt Sections */}
      <div className="mt-8 space-y-8">
        <TraktSection type="trending" mediaType="movies" />
        <TraktSection type="trending" mediaType="shows" />
        {isTraktAuthenticated() && (
          <>
            <TraktSection type="watchlist" mediaType="movies" />
            <TraktSection type="history" mediaType="shows" />
            <TraktSection type="recommendations" mediaType="movies" />
          </>
        )}
        <TraktSection type="popular" mediaType="shows" />
      </div>

      <BrowseModal />
    </div>
  );
}

function inferIdFromGuid(m: any): string | undefined {
  const g = String(m.guid || '');
  if (!g) return undefined;
  const num = (g.match(/(\d{3,})/) || [])[1];
  if (g.includes('tmdb://') && num) {
    const type = (m.type === 'movie') ? 'movie' : (m.type === 'show' ? 'tv' : 'movie');
    return `tmdb:${type}:${num}`;
  }
  return undefined;
}
