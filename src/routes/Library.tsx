import VirtualGrid from '@/components/VirtualGrid';
import PosterCard from '@/components/PosterCard';
import FilterBar from '@/components/FilterBar';
import { loadSettings } from '@/state/settings';
import { plexLibs, plexSectionAll, plexImage, withContainer } from '@/services/plex';
import SectionBanner from '@/components/SectionBanner';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

type Item = { id: string; title: string; image?: string; subtitle?: string; badge?: string };

export default function Library() {
  const nav = useNavigate();
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
        const libs: any = await plexLibs({ baseUrl: s.plexBaseUrl!, token: s.plexToken! });
        const dir = libs?.MediaContainer?.Directory || [];
        const secs = dir
          .filter((d: any) => d.type === 'movie' || d.type === 'show')
          .map((d: any) => ({ key: String(d.key), title: d.title, type: d.type }));
        setSections(secs);
        const preferred = secs.find((x: any) => x.type === 'movie') || secs[0];
        if (preferred) setActive(preferred.key);
        else setNeedsPlex(true);
      } catch (e) {
        console.error(e); setNeedsPlex(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const s = loadSettings();
    if (!active || !s.plexBaseUrl || !s.plexToken) return;
    async function loadItems(reset = true) {
      const base = '?sort=addedAt:desc';
      const size = 100;
      const qs = withContainer(base, reset ? 0 : start, size);
      const all: any = await plexSectionAll({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, active, qs);
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
    <div className="bg-app-gradient pb-8">
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
                  const base = '?sort=addedAt:desc';
                  const size = 100;
                  const qs = withContainer(base, start, size);
                  const all: any = await plexSectionAll({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, active, qs);
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
