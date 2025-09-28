import VirtualGrid from '@/components/VirtualGrid';
import PosterCard from '@/components/PosterCard';
import FilterBar from '@/components/FilterBar';
import { loadSettings } from '@/state/settings';
import { plexLibs, plexSectionAll, plexImage, withContainer } from '@/services/plex';
import { plexBackendLibraries, plexBackendLibraryAll } from '@/services/plex_backend';
import SectionBanner from '@/components/SectionBanner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

type Item = { id: string; title: string; image?: string; subtitle?: string; badge?: string };

export default function Library() {
  const nav = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<Item[]>([]);
  const [start, setStart] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sections, setSections] = useState<Array<{ key: string; title: string; type: 'movie'|'show' }>>([]);
  const [active, setActive] = useState<string>('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'movies' | 'shows'>('all');
  const [needsPlex, setNeedsPlex] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    if (!s.plexBaseUrl || !s.plexToken) { setNeedsPlex(true); return; }
    async function load() {
      try {
        const USE_BACKEND = (import.meta as any).env?.VITE_USE_BACKEND_PLEX === 'true' || (import.meta as any).env?.VITE_USE_BACKEND_PLEX === true;
        const libs: any = USE_BACKEND ? await plexBackendLibraries() : await plexLibs({ baseUrl: s.plexBaseUrl!, token: s.plexToken! });
        const dir = libs?.MediaContainer?.Directory || [];
        const secs = dir
          .filter((d: any) => d.type === 'movie' || d.type === 'show')
          .map((d: any) => ({ key: String(d.key), title: d.title, type: d.type }));
        setSections(secs);
        // Choose default section based on URL tab parameter
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab'); // 'tv' | 'movies'
        const wantType: 'show'|'movie' | null = tab === 'tv' ? 'show' : tab === 'movies' ? 'movie' : null;
        const preferred = wantType ? secs.find((x: any) => x.type === wantType) : (secs[0] || null);
        if (preferred) setActive(preferred.key);
        else setNeedsPlex(true);
      } catch (e) {
        console.error(e); setNeedsPlex(true);
      }
    }
    load();
  }, [location.search]);

  // If user switches between /library?tab=tv and /library?tab=movies while already loaded,
  // update the active section accordingly.
  useEffect(() => {
    if (sections.length === 0) return;
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const wantType: 'show'|'movie' | null = tab === 'tv' ? 'show' : tab === 'movies' ? 'movie' : null;
    if (!wantType) return;
    const preferred = sections.find((s) => s.type === wantType);
    if (preferred && preferred.key !== active) setActive(preferred.key);
  }, [location.search, sections]);

  // Reload app when server changes so sections/items refresh
  useEffect(() => {
    const handler = () => window.location.reload();
    // @ts-ignore
    window.addEventListener('plex-server-changed', handler as any);
    return () => {
      // @ts-ignore
      window.removeEventListener('plex-server-changed', handler as any);
    };
  }, []);

  useEffect(() => {
    const s = loadSettings();
    if (!active || !s.plexBaseUrl || !s.plexToken) return;
    async function loadItems(reset = true) {
      const USE_BACKEND = (import.meta as any).env?.VITE_USE_BACKEND_PLEX === 'true' || (import.meta as any).env?.VITE_USE_BACKEND_PLEX === true;
      const base = '?sort=addedAt:desc';
      const size = 100;
      const nextOffset = reset ? 0 : start;
      const all: any = USE_BACKEND
        ? await plexBackendLibraryAll(active, { sort: 'addedAt:desc', offset: nextOffset, limit: size })
        : await plexSectionAll({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, active, withContainer(base, nextOffset, size));
      const mc = all?.MediaContainer?.Metadata || [];
      const mapped: Item[] = mc.map((m: any, i: number) => ({
        id: String(m.ratingKey || i),
        title: m.title || m.grandparentTitle,
        image: plexImage(s.plexBaseUrl!, s.plexToken!, m.thumb || m.parentThumb || m.grandparentThumb),
        subtitle: m.year ? String(m.year) : undefined,
        badge: 'Plex',
      }));
      if (reset) setItems(mapped); else setItems((prev) => [...prev, ...mapped]);
      const total = all?.MediaContainer?.totalSize ?? (reset ? mapped.length : items.length + mapped.length);
      const newStart = (reset ? 0 : start) + mapped.length;
      setStart(newStart);
      setHasMore(newStart < total);
    }
    setStart(0); setHasMore(true); loadItems(true);
  }, [active]);

  const filtered = useMemo(() => items.filter((it) => it.title.toLowerCase().includes(query.toLowerCase())), [items, query]);

  return (
    <div className="pb-8">
      {!needsPlex && sections.length>0 ? (
        <div className="page-gutter pt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {sections.map(s => (
              <button key={s.key} onClick={() => setActive(s.key)} className={`h-8 px-3 rounded-full text-sm ring-1 ${active===s.key? 'bg-white text-black ring-white/0':'bg-white/5 text-neutral-200 hover:bg-white/10 ring-white/10'}`}>{s.title}</button>
            ))}
          </div>
        <FilterBar
          query={query}
          setQuery={setQuery}
          type={filter}
          setType={(v) => setFilter(v as any)}
          genres={[{label:'Action', value:'action'},{label:'Drama',value:'drama'}]}
          years={Array.from({length: 10}).map((_,i)=>({label:String(2024-i), value:String(2024-i)}))}
        />
        </div>
      ) : (
        <SectionBanner title="Libraries" message="Connect Plex to browse your Movies and TV Show libraries here." cta="Open Settings" to="/settings" />
      )}
      {!needsPlex && active && (
        <div className="page-gutter mt-4">
          <div className="row-band">
            <VirtualGrid
              items={filtered}
              hasMore={hasMore}
              loadMore={() => {
                if (!hasMore) return;
                const s = loadSettings();
                if (!s.plexBaseUrl || !s.plexToken || !active) return;
              // load next page
              (async () => {
                  const USE_BACKEND = (import.meta as any).env?.VITE_USE_BACKEND_PLEX === 'true' || (import.meta as any).env?.VITE_USE_BACKEND_PLEX === true;
                  const base = '?sort=addedAt:desc';
                  const size = 100;
                  const qs = withContainer(base, start, size);
                  const all: any = USE_BACKEND
                    ? await plexBackendLibraryAll(active, { sort: 'addedAt:desc', offset: start, limit: size })
                    : await plexSectionAll({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, active, qs);
                  const mc = all?.MediaContainer?.Metadata || [];
                  const mapped: Item[] = mc.map((m: any, i: number) => ({
                    id: String(m.ratingKey || i),
                    title: m.title || m.grandparentTitle,
                    image: plexImage(s.plexBaseUrl!, s.plexToken!, m.thumb || m.parentThumb || m.grandparentThumb),
                    subtitle: m.year ? String(m.year) : undefined,
                  }));
                  setItems((prev) => [...prev, ...mapped]);
                  const total = all?.MediaContainer?.totalSize ?? (start + mapped.length);
                  const newStart = start + mapped.length;
                  setStart(newStart);
                  setHasMore(newStart < total);
                })();
              }}
              render={(it) => <div className="p-2"><PosterCard title={it.title} image={it.image} onClick={() => nav(`/details/plex:${it.id}`)} /></div>}
            />
          </div>
        </div>
      )}
    </div>
  );
}
