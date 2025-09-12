import { useEffect, useRef, useState } from 'react';

type HomeHeroProps = {
  title: string;
  overview?: string;
  backdropUrl?: string;
  posterUrl?: string;
  rating?: string;
  onPlay?: () => void;
  videoUrl?: string; // Plex Extras direct URL
  ytKey?: string; // YouTube trailer key fallback
};

export default function HomeHero({ title, overview, backdropUrl, posterUrl, rating, onPlay, videoUrl, ytKey }: HomeHeroProps) {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const scrollHandler = useRef<(e: any) => void>();

  useEffect(() => {
    const t = setTimeout(() => setPlaying(true), 2500);
    scrollHandler.current = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setPlaying(y < 120);
    };
    window.addEventListener('scroll', scrollHandler.current);
    return () => { clearTimeout(t); if (scrollHandler.current) window.removeEventListener('scroll', scrollHandler.current); };
  }, []);

  return (
    <div className="bleed" style={{ padding: '20px' }}>
      <div className="rounded-2xl overflow-hidden shadow-billboard ring-1 ring-white/10 bg-neutral-900/40 relative">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt={title}
            className={`w-full h-[56vh] md:h-[64vh] xl:h-[68vh] object-cover object-center transition-opacity duration-700 ${
              (videoUrl || ytKey) && playing ? 'opacity-0' : 'opacity-100'
            }`}
          />
        ) : (
          <div className={`w-full h-[56vh] md:h-[64vh] xl:h-[68vh] bg-neutral-900 transition-opacity duration-700 ${
            (videoUrl || ytKey) && playing ? 'opacity-0' : 'opacity-100'
          }`} />
        )}
        {(videoUrl || ytKey) && (
          <div className="absolute inset-0 z-0 opacity-40">
            {videoUrl ? (
              <video id="home-plex-trailer" className="w-full h-full object-cover pointer-events-none" src={videoUrl} autoPlay={playing} muted={muted} loop playsInline />
            ) : ytKey ? (
              <iframe id="home-yt-trailer" className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${ytKey}?autoplay=${playing?1:0}&mute=${muted?1:0}&controls=0&loop=1&playsinline=1&rel=0&showinfo=0&modestbranding=1&playlist=${ytKey}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
            ) : null}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        {/* Floating controls */}
        {(videoUrl || ytKey) && (
          <button
            className="hero-mute"
            title={muted ? 'Unmute trailer' : 'Mute trailer'}
            onClick={() => setMuted((m) => !m)}
            style={{ right: 16, top: 16 }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        )}
        <div className="absolute left-6 md:left-10 bottom-6 md:bottom-10 flex items-end gap-6">
          {posterUrl && (
            <div className="hidden md:block w-[200px] md:w-[240px]">
              <div className="rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                <img src={posterUrl} className="w-full h-auto object-cover" />
              </div>
            </div>
          )}
          <div className="hero-panel">
            <div className="text-xs tracking-wide text-brand mb-1">{rating || 'TITLE'}</div>
            <TitleOrLogo title={title} />
            {overview && <p className="text-neutral-300 max-w-3xl line-clamp-3 md:line-clamp-4 mb-4">{overview}</p>}
            <div className="flex items-center gap-3">
              {onPlay && (
                <button onClick={onPlay} className="px-6 py-2.5 rounded-md font-semibold text-black bg-white hover:bg-neutral-100 shadow">▶ Play</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TitleOrLogo({ title }: { title: string }) {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    // Allow parent to set via DOM custom event if already fetched elsewhere; else keep text.
    const handler = (e: any) => setLogoUrl(e.detail?.logoUrl);
    window.addEventListener('home-hero-logo', handler as any);
    return () => window.removeEventListener('home-hero-logo', handler as any);
  }, []);
  if (logoUrl) return <img src={logoUrl} alt={title} className="h-10 md:h-16 object-contain mb-3" />;
  return <h1 className="text-3xl md:text-5xl font-bold mb-3">{title}</h1>;
}
