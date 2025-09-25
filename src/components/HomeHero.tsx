import { useEffect, useRef, useState } from 'react';

type HomeHeroProps = {
  title: string;
  overview?: string;
  backdropUrl?: string;
  posterUrl?: string;
  rating?: string;
  year?: string;
  runtime?: number;
  genres?: string[];
  onPlay?: () => void;
  onMoreInfo?: () => void;
  videoUrl?: string; // Plex Extras direct URL
  ytKey?: string; // YouTube trailer key fallback
  logoUrl?: string;
};

export default function HomeHero({
  title,
  overview,
  backdropUrl,
  posterUrl,
  rating,
  year,
  runtime,
  genres = [],
  onPlay,
  onMoreInfo,
  videoUrl,
  ytKey,
  logoUrl
}: HomeHeroProps) {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [localLogoUrl, setLocalLogoUrl] = useState(logoUrl);
  const scrollHandler = useRef<(e: any) => void>();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setPlaying(true), 3000);
    scrollHandler.current = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setPlaying(y < 120);
    };
    window.addEventListener('scroll', scrollHandler.current);

    // Listen for logo updates
    const logoHandler = (e: any) => setLocalLogoUrl(e.detail?.logoUrl);
    window.addEventListener('home-hero-logo', logoHandler as any);

    return () => {
      clearTimeout(t);
      if (scrollHandler.current) window.removeEventListener('scroll', scrollHandler.current);
      window.removeEventListener('home-hero-logo', logoHandler as any);
    };
  }, []);

  useEffect(() => {
    setLocalLogoUrl(logoUrl);
  }, [logoUrl]);

  // Handle video ended
  const handleVideoEnded = () => {
    setPlaying(false);
  };

  // Metadata badges
  const metaBadges = [];
  if (year) metaBadges.push(year);
  if (runtime) metaBadges.push(`${runtime} min`);
  if (rating) metaBadges.push(rating);

  return (
    <div className="relative w-full min-h-[85vh] md:min-h-[90vh] overflow-hidden">
      {/* Background Image/Video Layer */}
      <div className="absolute inset-0">
        {/* Backdrop image with mask for seamless fade */}
        {backdropUrl && (
          <div className="absolute inset-0">
            <img
              src={backdropUrl}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                imageLoaded && !playing ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0) 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0) 100%)'
              }}
              onLoad={() => setImageLoaded(true)}
            />
          </div>
        )}

        {/* Trailer overlay */}
        {playing && (videoUrl || ytKey) && (
          <div className="absolute inset-0">
            {videoUrl ? (
              <video
                ref={videoRef}
                id="home-plex-trailer"
                className="w-full h-full object-cover"
                style={{
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0) 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0) 100%)'
                }}
                src={videoUrl}
                autoPlay
                muted={muted}
                loop={false}
                playsInline
                onEnded={handleVideoEnded}
              />
            ) : ytKey ? (
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0) 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.8) 80%, rgba(0,0,0,0) 100%)'
                }}
              >
                <iframe
                  id="home-yt-trailer"
                  className="absolute inset-0 w-full h-full scale-125 origin-center"
                  src={`https://www.youtube.com/embed/${ytKey}?autoplay=1&mute=${
                    muted ? 1 : 0
                  }&controls=0&loop=0&playsinline=1&rel=0&showinfo=0&modestbranding=1&enablejsapi=1&origin=${window.location.origin}`}
                  allow="autoplay; encrypted-media"
                  style={{ pointerEvents: 'none' }}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Gradient Overlays - seamless blend with page */}
        <div className="absolute inset-0">
          {/* Bottom fade - matches page background */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/80 via-50% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/40 via-60% to-transparent" />
          {/* Side fade for content readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 via-50% to-transparent" />
          {/* Extra bottom blend for seamless transition */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0b0b0b] to-transparent" />
        </div>
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col justify-end min-h-[85vh] md:min-h-[90vh]">
        <div className="px-4 md:px-8 lg:px-12 xl:px-16 pb-12 md:pb-16">
          <div className="flex items-end gap-6">
            {/* Poster - visible on larger screens */}
            {posterUrl && (
              <div className="hidden lg:block flex-shrink-0">
                <div className="w-[280px] xl:w-[320px] rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                  <img
                    src={posterUrl}
                    alt={title}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1">
              {/* Title/Logo */}
              <div className="mb-6">
                {localLogoUrl ? (
                  <img
                    src={localLogoUrl}
                    alt={title}
                    className="h-24 md:h-32 lg:h-40 max-w-[90vw] md:max-w-[60vw] object-contain drop-shadow-2xl"
                    style={{ filter: 'drop-shadow(0 10px 40px rgba(0,0,0,0.8))' }}
                  />
                ) : (
                  <h1
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-4xl"
                    style={{ textShadow: '0 10px 40px rgba(0,0,0,0.8)' }}
                  >
                    {title}
                  </h1>
                )}
              </div>

              {/* Metadata */}
              {(metaBadges.length > 0 || genres.length > 0) && (
                <div className="flex flex-wrap items-center gap-3 mb-6 text-sm md:text-base">
                  {metaBadges.map((badge, i) => (
                    <span key={i} className="text-white/90 font-medium">
                      {badge}
                    </span>
                  ))}
                  {metaBadges.length > 0 && genres.length > 0 && (
                    <span className="text-white/40">•</span>
                  )}
                  {genres.slice(0, 3).map((genre, i) => (
                    <span key={i} className="text-white/70">
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              {overview && (
                <p className="max-w-3xl mb-8 text-base md:text-lg text-white/80 leading-relaxed line-clamp-3 md:line-clamp-4">
                  {overview}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {onPlay && (
                  <button
                    onClick={onPlay}
                    className="inline-flex items-center px-6 py-3 text-base font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-all"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play
                  </button>
                )}

                {onMoreInfo && (
                  <button
                    onClick={onMoreInfo}
                    className="inline-flex items-center px-5 py-3 text-base font-medium text-white bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    More Info
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mute Button */}
      {(playing || (!playing && (videoUrl || ytKey))) && (
        <button
          onClick={() => setMuted(!muted)}
          className="absolute bottom-8 right-8 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all z-20"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          )}
        </button>
      )}
    </div>
  );
}