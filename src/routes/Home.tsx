import Billboard from '@/components/Billboard';
import HomeHero from '@/components/HomeHero';
import Row from '@/components/Row';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSettings } from '@/state/settings';
import { tmdbTrending, tmdbImage, tmdbVideos, tmdbImages } from '@/services/tmdb';
import { traktTrending } from '@/services/trakt';
import { plexOnDeckGlobal, plexImage, plexLibs, plexSectionAll, plexMetadataWithExtras, plexPartUrl, plexLibrarySecondary, plexDir } from '@/services/plex';
import BrowseModal from '@/components/BrowseModal';
import { plexTvWatchlist } from '@/services/plextv';
import SectionBanner from '@/components/SectionBanner';

type Item = { id: string; title: string; image?: string; subtitle?: string; badge?: string };

export default function Home() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ title: string; items: Item[]; variant?: 'default'|'continue' }>>([]);
  const [needsPlex, setNeedsPlex] = useState(false);
  const [hero, setHero] = useState<{ title: string; overview?: string; poster?: string; backdrop?: string; rating?: string; videoUrl?: string; ytKey?: string; id?: string } | null>(null);
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

  useEffect(() => {
    const s = loadSettings();
    async function run() {
      try {
        const rowsData: Array<{ title: string; items: Item[]; variant?: 'default'|'continue' }> = [];
        if (s.tmdbBearer) {
          const tmdb = await tmdbTrending(s.tmdbBearer, 'tv', 'week');
          const items: Item[] = (tmdb as any).results?.slice(0, 16).map((r: any) => ({
            id: `tmdb:tv:${String(r.id)}`,
            title: r.name || r.title,
            image: tmdbImage(r.backdrop_path, 'w780') || tmdbImage(r.poster_path, 'w500'),
          })) || [];
          rowsData.push({ title: 'Popular on Netflix', items: items.slice(0, 8) });
          rowsData.push({ title: 'Trending Now', items: items.slice(8, 16) });
          // Fallback hero (TMDB) if Plex not configured or if we fail to get Plex hero
          try {
            if (!hero && (tmdb as any).results?.length) {
              const f = (tmdb as any).results[0];
              // Attempt to fetch a video key for trailer
              let ytKey: string | undefined;
              try { const vids: any = await tmdbVideos(s.tmdbBearer!, 'tv', String(f.id)); ytKey = (vids.results||[]).find((v:any)=>v.site==='YouTube')?.key; } catch {}
              setHero({ title: f.name||f.title, overview: f.overview, poster: tmdbImage(f.poster_path,'w500')||undefined, backdrop: tmdbImage(f.backdrop_path,'w1280')||undefined, rating: undefined, ytKey, id: `tmdb:tv:${String(f.id)}` });
              // Try fetch logo and broadcast to HomeHero via custom event
              try {
                const imgs: any = await tmdbImages(s.tmdbBearer!, 'tv', String(f.id), 'en,null');
                const logo = (imgs?.logos||[]).find((l:any)=>l.iso_639_1==='en') || (imgs?.logos||[])[0];
                if (logo?.file_path) {
                  const url = tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original');
                  if (url) window.dispatchEvent(new CustomEvent('home-hero-logo', { detail: { logoUrl: url } }));
                }
              } catch {}
            }
          } catch {}
        } else {
          // Fallback placeholders (no TMDB key)
          const landscape = Array.from({ length: 16 }).map((_, i) => ({ id: 'ph'+i, title: `Sample ${i+1}`, image: `https://picsum.photos/seed/land${i}/800/400` }));
          rowsData.push({ title: 'Popular on Netflix', items: landscape.slice(0, 8) });
          rowsData.push({ title: 'Trending Now', items: landscape.slice(8, 16) });
        }
        if (s.traktClientId) {
          const tr = await traktTrending(s.traktClientId, 'shows');
          const items: Item[] = (tr as any)?.slice(0, 10).map((x: any, i: number) => ({
            id: `tmdb:tv:${String(x?.show?.ids?.tmdb || x?.show?.ids?.slug || i)}`,
            title: x?.show?.title || 'Show',
            image: `https://picsum.photos/seed/trakt${i}/800/400`,
          })) || [];
          rowsData.push({ title: 'Trakt Trending', items });
        }
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
              setHero({ title: mm.title || mm.grandparentTitle || 'Title', overview: mm.summary, poster, backdrop, rating: mm.contentRating || undefined, videoUrl, id: `plex:${String(mm.ratingKey)}` });
              // If this item has a TMDB GUID, try TMDB logo and dispatch
              try {
                const tmdbGuid = (mm.Guid || []).map((g:any)=>String(g.id||''))
                  .find((g:string)=>g.includes('tmdb://')||g.includes('themoviedb://'));
                if (tmdbGuid && s.tmdbBearer) {
                  const tid = tmdbGuid.split('://')[1];
                  const mediaType = (mm.type === 'movie') ? 'movie' : 'tv';
                  const imgs: any = await tmdbImages(s.tmdbBearer!, mediaType as any, tid, 'en,null');
                  const logo = (imgs?.logos||[]).find((l:any)=>l.iso_639_1==='en') || (imgs?.logos||[])[0];
                  if (logo?.file_path) {
                    const url = tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original');
                    if (url) window.dispatchEvent(new CustomEvent('home-hero-logo', { detail: { logoUrl: url } }));
                  }
                }
              } catch {}
              break;
            }
          } catch (e) { /* ignore */ }
        } else {
          setNeedsPlex(true);
        }
        setRows(rowsData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, []);

  return (
    <div className="pb-10 bg-app-gradient">
      <div className="pt-16" />
      {hero ? (
        <HomeHero
          title={hero.title}
          overview={hero.overview}
          posterUrl={hero.poster}
          backdropUrl={hero.backdrop}
          rating={hero.rating}
          videoUrl={hero.videoUrl}
          ytKey={hero.ytKey}
          onPlay={() => { if (hero.id) nav(`/details/${encodeURIComponent(hero.id)}`); }}
        />
      ) : (
        <Billboard image={`https://picsum.photos/seed/bill/1600/800`} rating="TV-Y7" onPlay={() => {}} />
      )}
      <div className="mt-6" />
      {needsPlex && (
        <SectionBanner title="Continue Watching" message="Connect your Plex account to see your in‑progress shows and movies here." cta="Open Settings" to="/settings" />
      )}
      {!loading && rows.map((r: any) => (
        <Row key={r.title} title={r.title} items={r.items as any} variant={r.variant} browseKey={r.browseKey} onItemClick={(id) => nav(`/details/${encodeURIComponent(id)}`)} />
      ))}
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
