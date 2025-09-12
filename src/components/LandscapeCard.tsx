import { useEffect, useState } from 'react';
import { loadSettings } from '@/state/settings';
import { tmdbBestBackdropUrl } from '@/services/tmdb';
import { plexMetadata } from '@/services/plex';

type CardProps = { id: string; title: string; image: string; badge?: string; onClick?: (id: string) => void };

export default function LandscapeCard({ id, title, image, badge, onClick }: CardProps) {
  const [altImg, setAltImg] = useState<string | undefined>(undefined);
  useEffect(() => {
    const s = loadSettings();
    // If this is a TMDB item, try to fetch a language-specific backdrop (with title text)
    if (s.tmdbBearer && id.startsWith('tmdb:')) {
      const parts = id.split(':'); // tmdb:<media>:<id>
      if (parts.length === 3) {
        const media = parts[1] as 'movie' | 'tv';
        const tmdbId = parts[2];
        tmdbBestBackdropUrl(s.tmdbBearer!, media, tmdbId, 'en').then((u) => { if (u) setAltImg(u); }).catch(()=>{});
      }
    }
    // Attempt Plex -> TMDB mapping if possible (best-effort, cached)
    else if (s.tmdbBearer && id.startsWith('plex:') && s.plexBaseUrl && s.plexToken) {
      const rk = id.replace(/^plex:/,'');
      plexMetadata({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, rk).then(async (meta: any) => {
        try {
          const m = meta?.MediaContainer?.Metadata?.[0];
          const guid = (m?.Guid || []).map((g:any)=>String(g.id||''))
            .find((g:string)=>g.includes('tmdb://')||g.includes('themoviedb://'));
          if (!guid) return;
          const tid = guid.split('://')[1];
          const media = (m?.type === 'movie') ? 'movie' : 'tv';
          const u = await tmdbBestBackdropUrl(s.tmdbBearer!, media as any, tid, 'en');
          if (u) setAltImg(u);
        } catch {}
      }).catch(()=>{});
    }
  }, [id]);
  const src = altImg || image;
  return (
    <button onClick={() => onClick?.(id)} className="group flex-shrink-0 w-[360px] md:w-[420px]">
      <div className="relative aspect-[2/1] card card-hover">
        <img src={src} alt={title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        {badge && <span className="absolute top-2 left-2 text-xs bg-black/70 text-white px-2 py-0.5 rounded">{badge}</span>}
      </div>
    </button>
  );
}
