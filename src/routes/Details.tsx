import { useParams, useNavigate } from 'react-router-dom';
import Badge from '@/components/Badge';
import Row from '@/components/Row';
import { loadSettings } from '@/state/settings';
import { plexMetadata, plexImage, plexSearch, plexChildren, plexFindByGuid, plexMetadataWithExtras, plexPartUrl } from '@/services/plex';
import { tmdbDetails, tmdbImage, tmdbCredits, tmdbExternalIds, tmdbRecommendations, tmdbVideos, tmdbSearchTitle, tmdbTvSeasons, tmdbTvSeasonEpisodes, tmdbSimilar, tmdbImages } from '@/services/tmdb';
import PersonModal from '@/components/PersonModal';
import { useEffect, useState } from 'react';
import Tabs from '@/components/Tabs';
import TechnicalChips from '@/components/TechnicalChips';
import VersionSelector from '@/components/VersionSelector';
import Toast from '@/components/Toast';
import EpisodeItem from '@/components/EpisodeItem';
import EpisodeSkeletonList from '@/components/EpisodeSkeletonList';
import SkeletonRow from '@/components/SkeletonRow';
import TrackPicker, { Track } from '@/components/TrackPicker';
import BrowseModal from '@/components/BrowseModal';

export default function Details() {
  let { id } = useParams();
  id = id ? decodeURIComponent(id) : id;
  const nav = useNavigate();
  const [title, setTitle] = useState<string>('');
  const [overview, setOverview] = useState<string>('');
  const [badges, setBadges] = useState<string[]>([]);
  const [backdrop, setBackdrop] = useState<string>('');
  const [related, setRelated] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ genres?: string[]; runtime?: number; rating?: string }>({});
  const [year, setYear] = useState<string | undefined>(undefined);
  const [cast, setCast] = useState<Array<{ id?: string; name: string; img?: string }>>([]);
  const [plexWatch, setPlexWatch] = useState<string | undefined>(undefined);
  const [poster, setPoster] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('RECOMMENDATIONS');
  const [seasons, setSeasons] = useState<Array<{key:string; title:string}>>([]);
  const [seasonKey, setSeasonKey] = useState<string>('');
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [tech, setTech] = useState<any>({});
  const [versions, setVersions] = useState<Array<{id:string; label:string}>>([]);
  const [activeVersion, setActiveVersion] = useState<string | undefined>(undefined);
  const [versionPartMap, setVersionPartMap] = useState<Record<string, string>>({});
  const [versionDetails, setVersionDetails] = useState<Array<{id:string; label:string; audios: Track[]; subs: Track[]; tech: any}>>([]);
  const [infoVersion, setInfoVersion] = useState<string | undefined>(undefined);
  const [audioTracks, setAudioTracks] = useState<Track[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<Track[]>([]);
  const [activeAudio, setActiveAudio] = useState<string | undefined>(undefined);
  const [activeSub, setActiveSub] = useState<string | undefined>(undefined);
  const [plexDetailsUrl, setPlexDetailsUrl] = useState<string | undefined>(undefined);
  const [trailerKey, setTrailerKey] = useState<string | undefined>(undefined);
  const [trailerMuted, setTrailerMuted] = useState<boolean>(true);
  const [showTrailer, setShowTrailer] = useState<boolean>(false);
  const [plexTrailerUrl, setPlexTrailerUrl] = useState<string | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [showMediaInfo, setShowMediaInfo] = useState<boolean>(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [personId, setPersonId] = useState<string | undefined>(undefined);
  const [personName, setPersonName] = useState<string | undefined>(undefined);
  const [tmdbCtx, setTmdbCtx] = useState<{ media?: 'movie'|'tv'; id?: string } | undefined>(undefined);
  const [kind, setKind] = useState<'movie'|'tv'|undefined>(undefined);

  useEffect(() => {
    // expose setter for trailer mute to toggle function
    (window as any).reactSetTrailerMuted = setTrailerMuted;
    const s = loadSettings();
    async function load() {
      if (!id) return;
      try {
        if (id.startsWith('plex:') && s.plexBaseUrl && s.plexToken) {
          const rk = id.replace(/^plex:/, '');
          const meta: any = await plexMetadata({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, rk);
          const m = meta?.MediaContainer?.Metadata?.[0];
          if (m) {
            setTitle(m.title || m.grandparentTitle || '');
            setOverview(m.summary || '');
            setBackdrop(plexImage(s.plexBaseUrl!, s.plexToken!, m.art || m.thumb || m.parentThumb || m.grandparentThumb) || backdrop);
            setPoster(plexImage(s.plexBaseUrl!, s.plexToken!, m.thumb || m.parentThumb || m.grandparentThumb));
            setKind(m.type === 'movie' ? 'movie' : (m.type === 'show' ? 'tv' : undefined));
            setMeta({
              genres: (m.Genre || []).map((g: any) => g.tag),
              runtime: Math.round((m.duration || 0) / 60000),
              rating: m.contentRating || m.rating,
            });
            if (m.year) setYear(String(m.year));
            setCast((m.Role || []).slice(0, 12).map((r: any) => ({ name: r.tag, img: plexImage(s.plexBaseUrl!, s.plexToken!, r.thumb) })));
            // Badges detection
            const bs: string[] = [];
            const media = (m.Media || [])[0];
            if (media) {
              const w = media.width || 0; const h = media.height || 0; if (w >= 3800 || h >= 2100) bs.push('4K');
              const vp = (media.videoProfile || '').toLowerCase(); if (vp.includes('hdr') || vp.includes('hlg')) bs.push('HDR'); if (vp.includes('dv')) bs.push('Dolby Vision');
              const ap = (media.audioProfile || '').toLowerCase(); const ac = (media.audioCodec || '').toLowerCase(); if (ap.includes('atmos') || ac.includes('truehd')) bs.push('Atmos');
              setTech({
                rating: m.contentRating || m.rating,
                runtimeMin: Math.round((m.duration||0)/60000),
                videoCodec: media.videoCodec,
                videoProfile: media.videoProfile,
                resolution: w&&h? `${w}x${h}`: undefined,
                bitrateKbps: media.bitrate ? media.bitrate * 1000 : undefined,
                audioCodec: media.audioCodec,
                audioChannels: media.audioChannels,
                fileSizeMB: media.Part?.[0]?.size ? media.Part[0].size / (1024*1024) : undefined,
                subsCount: (media.Part?.[0]?.Stream||[]).filter((st:any)=>st.streamType===3).length,
              });
            }
            setBadges(bs);
            // Build watch URL (first Part)
            const part = media?.Part?.[0];
            if (part?.id) {
              const url = `${s.plexBaseUrl!.replace(/\/$/, '')}/library/parts/${part.id}/stream?X-Plex-Token=${s.plexToken}`;
              setPlexWatch(url);
            } else { setToast('No direct stream found. Open in Plex.'); }
            setPlexDetailsUrl(`${s.plexBaseUrl!.replace(/\/$/, '')}/web/index.html#!/details?key=/library/metadata/${m.ratingKey}`);
            // Versions
            const vs = (m.Media||[]).map((me:any, idx:number)=>({ id:String(me.id||idx), label: `${(me.width||0)>=3800?'4K':'HD'} ${String(me.videoCodec||'').toUpperCase()} ${me.audioChannels||''}` }));
            // Map version -> part id
            const vm: Record<string,string> = {};
            (m.Media||[]).forEach((me:any)=>{ const pid = me.Part?.[0]?.id; if ((me.id || me.Id) && pid) vm[String(me.id || me.Id)] = String(pid); });
            setVersionPartMap(vm);
            setVersions(vs); setActiveVersion(vs[0]?.id);
            // Build per-version media info
            try {
              const vds: Array<{id:string; label:string; audios: Track[]; subs: Track[]; tech: any}> = (m.Media||[]).map((mm:any)=>{
                const streams = mm?.Part?.[0]?.Stream || [];
                const auds: Track[] = streams.filter((st:any)=>st.streamType===2).map((st:any, i:number)=>({ id: String(st.id || i), label: (st.displayTitle || st.languageTag || st.language || `Audio ${i+1}`) }));
                const subs: Track[] = streams.filter((st:any)=>st.streamType===3).map((st:any, i:number)=>({ id: String(st.id || i), label: (st.displayTitle || st.languageTag || st.language || `Sub ${i+1}`) }));
                const w = mm.width || 0; const h = mm.height || 0;
                const techInfo = {
                  rating: meta.rating,
                  runtimeMin: Math.round((m.duration||0)/60000),
                  videoCodec: mm.videoCodec, videoProfile: mm.videoProfile,
                  resolution: w&&h? `${w}x${h}`: undefined,
                  bitrateKbps: mm.bitrate ? mm.bitrate * 1000 : undefined,
                  audioCodec: mm.audioCodec, audioChannels: mm.audioChannels,
                  fileSizeMB: mm.Part?.[0]?.size ? mm.Part[0].size / (1024*1024) : undefined,
                  subsCount: subs.length,
                };
                const label = `${(mm.width||0)>=3800?'4K':'HD'} ${String(mm.videoCodec||'').toUpperCase()} ${mm.audioChannels||''}`;
                return { id: String(mm.id||mm.Id), label, audios: auds, subs, tech: techInfo };
              });
              setVersionDetails(vds);
              setInfoVersion(vds[0]?.id);
              // Keep backward-compat tracks state for quick display
              const first = vds[0];
              if (first) { setAudioTracks(first.audios); setSubtitleTracks(first.subs); }
            } catch {}
            // If this Plex item has a TMDB GUID, prefer TMDB textual metadata and recs/videos
            const tmdbGuid = (m.Guid || []).map((g:any)=>String(g.id||''))
              .find((g:string)=>g.includes('tmdb://')||g.includes('themoviedb://'));
            if (s.tmdbBearer && tmdbGuid) {
              const tid = tmdbGuid.split('://')[1];
              const mediaType = (m.type === 'movie') ? 'movie' : 'tv';
              setKind(mediaType);
                try {
                  const d: any = await tmdbDetails(s.tmdbBearer!, mediaType as any, tid);
                  setTitle(d.title || d.name || title);
                  setOverview(d.overview || overview);
                  setPoster(tmdbImage(d.poster_path, 'w500') || poster);
                  setMeta({ genres: (d.genres||[]).map((x:any)=>x.name), runtime: Math.round((d.runtime||d.episode_run_time?.[0]||0)), rating: m.contentRating || m.rating });
                  const y2 = (d.release_date || d.first_air_date || '').slice(0,4); if (y2) setYear(y2);
                  // Try fetch a logo image
                  try {
                    const imgs: any = await tmdbImages(s.tmdbBearer!, mediaType as any, tid, 'en,null');
                    const logo = (imgs?.logos||[]).find((l:any)=>l.iso_639_1==='en') || (imgs?.logos||[])[0];
                    if (logo?.file_path) setLogoUrl(tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original'));
                  } catch {}
                  try {
                    const cr: any = await tmdbCredits(s.tmdbBearer!, mediaType as any, tid);
                    setCast((cr.cast||[]).slice(0,12).map((c:any)=>({ id:String(c.id), name:c.name, img: tmdbImage(c.profile_path,'w500') })));
                  } catch {}
                  try {
                  const vids:any = await tmdbVideos(s.tmdbBearer!, mediaType as any, tid);
                  const yt = (vids.results||[]).find((v:any)=>v.site==='YouTube'&&(v.type==='Trailer'||v.type==='Teaser'));
                  if (yt) setTimeout(()=>{ setTrailerKey(yt.key); setShowTrailer(true); }, 2000);
                } catch {}
                try {
                  const recs:any = await tmdbRecommendations(s.tmdbBearer!, mediaType as any, tid);
                  setRelated((recs.results||[]).slice(0,8).map((r:any)=>({ id:`tmdb:${mediaType}:${r.id}`, title:r.title||r.name, image: tmdbImage(r.backdrop_path,'w780')||tmdbImage(r.poster_path,'w500') })));
                } catch {}
                try {
                  const sim:any = await tmdbSimilar(s.tmdbBearer!, mediaType as any, tid);
                  setSimilar((sim.results||[]).slice(0,8).map((r:any)=>({ id:`tmdb:${mediaType}:${r.id}`, title:r.title||r.name, image: tmdbImage(r.backdrop_path,'w780')||tmdbImage(r.poster_path,'w500') })));
                } catch {}
              } catch (e) { console.error(e); }
            }
            // Try Plex Extras for trailer preview
            try {
              const ex: any = await plexMetadataWithExtras({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, rk);
              const em = ex?.MediaContainer?.Metadata?.[0]?.Extras?.Metadata?.[0];
              const pkey = em?.Media?.[0]?.Part?.[0]?.key as string | undefined;
              if (pkey) {
                setPlexTrailerUrl(plexPartUrl(s.plexBaseUrl!, s.plexToken!, pkey));
                setTimeout(()=> setShowTrailer(true), 2000);
              }
            } catch {}
            // Seasons for Plex-native series
            if (m.type === 'show') {
              try {
                const ch: any = await plexChildren({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, rk);
                const ss = (ch?.MediaContainer?.Metadata||[]).map((x:any)=>({ key:String(x.ratingKey), title:x.title }));
                setSeasons(ss);
                if (ss[0]) setSeasonKey(ss[0].key);
                setActiveTab('EPISODES');
              } catch (e) { console.error(e); }
            }
          }
        } else if (id.startsWith('tmdb:')) {
          const [, media, tmdbId] = id.split(':');
          if (s.tmdbBearer) {
            const d: any = await tmdbDetails(s.tmdbBearer!, media as any, tmdbId);
            setTitle(d.title || d.name || '');
            setOverview(d.overview || '');
            setBackdrop(tmdbImage(d.backdrop_path, 'w1280') || tmdbImage(d.poster_path, 'w780') || backdrop);
            setPoster(tmdbImage(d.poster_path, 'w500') || poster);
            setMeta({
              genres: (d.genres || []).map((g: any) => g.name),
              runtime: Math.round((d.runtime || d.episode_run_time?.[0] || 0)),
              rating: d.adult ? '18+' : undefined,
            });
            const y = (d.release_date || d.first_air_date || '').slice(0,4); if (y) setYear(y);
            setKind((media as any) === 'movie' ? 'movie' : 'tv');
            try {
              const cr: any = await tmdbCredits(s.tmdbBearer!, media as any, tmdbId);
              setCast((cr.cast || []).slice(0, 12).map((c: any) => ({ id: String(c.id), name: c.name, img: tmdbImage(c.profile_path, 'w500') })));
            } catch {}
            try {
              const vids: any = await tmdbVideos(s.tmdbBearer!, media as any, tmdbId);
              const yt = (vids.results || []).find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
              if (yt) setTimeout(() => { setTrailerKey(yt.key); setShowTrailer(true); }, 2000);
            } catch {}
            try {
              const recs: any = await tmdbRecommendations(s.tmdbBearer!, media as any, tmdbId);
              setRelated((recs.results || []).slice(0, 8).map((r: any) => ({ id: `tmdb:${media}:${r.id}`, title: r.title || r.name, image: tmdbImage(r.backdrop_path, 'w780') || tmdbImage(r.poster_path, 'w500') })));
            } catch {}
            try {
              const sim: any = await tmdbSimilar(s.tmdbBearer!, media as any, tmdbId);
              setSimilar((sim.results || []).slice(0, 8).map((r: any) => ({ id: `tmdb:${media}:${r.id}`, title: r.title || r.name, image: tmdbImage(r.backdrop_path, 'w780') || tmdbImage(r.poster_path, 'w500') })));
            } catch {}
            setTmdbCtx({ media: media as any, id: String(tmdbId) });
            // Try to fetch a logo for the TMDB item
            try {
              const imgs: any = await tmdbImages(s.tmdbBearer!, media as any, tmdbId, 'en,null');
              const logo = (imgs?.logos||[]).find((l:any)=>l.iso_639_1==='en') || (imgs?.logos||[])[0];
              if (logo?.file_path) setLogoUrl(tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original'));
            } catch {}
            // TMDB seasons fallback (if mapping to Plex fails or no Plex)
            if (media === 'tv') {
              try {
                const tv: any = await tmdbTvSeasons(s.tmdbBearer!, tmdbId);
                const ss = (tv.seasons||[]).filter((x:any)=>x.season_number>0).map((x:any)=>({ key: String(x.season_number), title: `Season ${x.season_number}` }));
                if (ss.length) {
                  setSeasons(ss);
                  setSeasonKey(String(ss[0].key));
                  setActiveTab('EPISODES');
                }
              } catch (e) { console.error(e); }
            }
            const bs: string[] = [];
            if ((d?.belongs_to_collection)) bs.push('Collection');
            if ((d?.runtime ?? 0) > 0 || (d?.episode_run_time?.[0] ?? 0) > 0) bs.push('Runtime');
            setBadges(bs);
            // Try find on Plex (first by GUID, then fallback title/year search)
            if (s.plexBaseUrl && s.plexToken) {
              const q = d.title || d.name;
              if (q) {
                const guid = `tmdb://${tmdbId}`;
                let hits: any[] = [];
                try {
                  const byGuid: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, guid, media === 'movie' ? 1 : 2);
                  hits = (byGuid?.MediaContainer?.Metadata || []) as any[];
                } catch {}
                if (hits.length === 0) {
                  // Try themoviedb:// prefix used by some agents
                  try {
                    const byGuid2: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, `themoviedb://${tmdbId}`, media === 'movie' ? 1 : 2);
                    hits = (byGuid2?.MediaContainer?.Metadata || []) as any[];
                  } catch {}
                }
                if (hits.length === 0) {
                  // Try external ids (tvdb or imdb) from TMDB
                  try {
                    const ex: any = await tmdbExternalIds(s.tmdbBearer!, media as any, tmdbId);
                    if (ex?.tvdb_id) {
                      const byTvdb: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, `tvdb://${ex.tvdb_id}`, media === 'movie' ? 1 : 2);
                      hits = (byTvdb?.MediaContainer?.Metadata || []) as any[];
                    }
                    if (hits.length === 0 && ex?.imdb_id) {
                      const byImdb: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, `imdb://${ex.imdb_id}`, media === 'movie' ? 1 : 2);
                      hits = (byImdb?.MediaContainer?.Metadata || []) as any[];
                    }
                  } catch {}
                }
                if (hits.length === 0) {
                  const search: any = await plexSearch({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, q, (media === 'movie' ? 1 : 2));
                  hits = (search?.MediaContainer?.Metadata || []) as any[];
                }
                // Robust match: prefer GUID match to tmdb id; else title+year normalized
                const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
                const year = (d.release_date || d.first_air_date || '').slice(0,4);
                let match: any | undefined = undefined;
                for (const h of hits) {
                  const guids = (h.Guid || []).map((g: any) => String(g.id||''));
                  if (guids.some(g => g.includes(`tmdb://${tmdbId}`))) { match = h; break; }
                  if (guids.some(g => g.includes(`themoviedb://${tmdbId}`))) { match = h; break; }
                  if (norm(h.title||h.grandparentTitle||'') === norm(q) && (!year || String(h.year||'') === year)) { match = h; }
                }
                if (match) {
                  // Replace backdrop with plex art for authenticity and add badges
                  const m = match;
                  setBackdrop(plexImage(s.plexBaseUrl!, s.plexToken!, m.art || m.thumb || m.parentThumb || m.grandparentThumb) || backdrop);
                  const extra: string[] = [];
                  const media0 = (m.Media || [])[0];
                  if (media0) {
                    const w = media0.width || 0; const h = media0.height || 0; if (w >= 3800 || h >= 2100) extra.push('4K');
                    const vp = (media0.videoProfile || '').toLowerCase(); if (vp.includes('hdr') || vp.includes('hlg')) extra.push('HDR'); if (vp.includes('dv')) extra.push('Dolby Vision');
                    const ap = (media0.audioProfile || '').toLowerCase(); const ac = (media0.audioCodec || '').toLowerCase(); if (ap.includes('atmos') || ac.includes('truehd')) extra.push('Atmos');
                  }
                  // Per-version details for mapped Plex item
                  try {
                    const vds: Array<{id:string; label:string; audios: Track[]; subs: Track[]; tech: any}> = (m.Media||[]).map((mm:any)=>{
                      const streams = mm?.Part?.[0]?.Stream || [];
                      const auds: Track[] = streams.filter((st:any)=>st.streamType===2).map((st:any, i:number)=>({ id: String(st.id || i), label: (st.displayTitle || st.languageTag || st.language || `Audio ${i+1}`) }));
                      const subs: Track[] = streams.filter((st:any)=>st.streamType===3).map((st:any, i:number)=>({ id: String(st.id || i), label: (st.displayTitle || st.languageTag || st.language || `Sub ${i+1}`) }));
                      const w = mm.width || 0; const h = mm.height || 0;
                      const techInfo = {
                        rating: m.contentRating || m.rating,
                        runtimeMin: Math.round((m.duration||0)/60000),
                        videoCodec: mm.videoCodec, videoProfile: mm.videoProfile,
                        resolution: w&&h? `${w}x${h}`: undefined,
                        bitrateKbps: mm.bitrate ? mm.bitrate * 1000 : undefined,
                        audioCodec: mm.audioCodec, audioChannels: mm.audioChannels,
                        fileSizeMB: mm.Part?.[0]?.size ? mm.Part[0].size / (1024*1024) : undefined,
                        subsCount: subs.length,
                      };
                      const label = `${(mm.width||0)>=3800?'4K':'HD'} ${String(mm.videoCodec||'').toUpperCase()} ${mm.audioChannels||''}`;
                      return { id: String(mm.id||mm.Id), label, audios: auds, subs, tech: techInfo };
                    });
                    setVersionDetails(vds);
                    setInfoVersion(vds[0]?.id);
                  } catch {}
                  setBadges((b) => Array.from(new Set([...b, ...extra, 'Plex'])));
                  const part = media0?.Part?.[0];
                  if (part?.id) setPlexWatch(`${s.plexBaseUrl!.replace(/\/$/, '')}/library/parts/${part.id}/stream?X-Plex-Token=${s.plexToken}`);
                  // If it's a show, load seasons/episodes
                  if (m.type === 'show') {
                    try {
                      const ch: any = await plexChildren({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, String(m.ratingKey));
                      const ss = (ch?.MediaContainer?.Metadata || []).map((x: any) => ({ key: String(x.ratingKey), title: x.title }));
                      setSeasons(ss);
                      if (ss[0]) setSeasonKey(ss[0].key);
                    } catch (e) { console.error(e); }
                  }
                  // Prefer cast from Plex if available for better thumbs
                  if (match.Role && match.Role.length) setCast(match.Role.slice(0,12).map((r: any) => ({ name: r.tag, img: plexImage(s.plexBaseUrl!, s.plexToken!, r.thumb) })));
                  // Trailer from Plex Extras for matched item
                  try {
                    const ex: any = await plexMetadataWithExtras({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, String(m.ratingKey));
                    const em = ex?.MediaContainer?.Metadata?.[0]?.Extras?.Metadata?.[0];
                    const pkey = em?.Media?.[0]?.Part?.[0]?.key as string | undefined;
                    if (pkey) {
                      setPlexTrailerUrl(plexPartUrl(s.plexBaseUrl!, s.plexToken!, pkey));
                      setTimeout(()=> setShowTrailer(true), 2000);
                    }
                  } catch {}
                } else {
                  setBadges((b) => Array.from(new Set([...b, 'No local source'])));
                }
              }
            }
          }
        }
      } catch (e) { console.error(e); }
    }
    load();
  }, [id]);

  // Load episodes when a season is picked (Plex)
  useEffect(() => {
    const s = loadSettings();
    async function loadEps() {
      if (!seasonKey) return;
      try {
        // Prefer Plex episodes if plex seasonKey is numeric (ratingKey), otherwise use TMDB fallback
        if (/^\d+$/.test(seasonKey) && s.plexBaseUrl && s.plexToken) {
          const ch: any = await plexChildren({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, seasonKey);
          const eps = (ch?.MediaContainer?.Metadata||[]).map((e:any)=>({
            id: `plex:${e.ratingKey}`,
            title: e.title,
            overview: e.summary,
            image: plexImage(s.plexBaseUrl!, s.plexToken!, e.thumb || e.parentThumb),
            duration: Math.round((e.duration||0)/60000),
            progress: e.viewOffset ? Math.round(((e.viewOffset/1000)/((e.duration||1)/1000))*100) : 0,
          }));
          setEpisodes(eps);
        } else if (tmdbCtx?.media==='tv' && tmdbCtx?.id) {
          const tvSeason = Number(seasonKey);
          const data: any = await tmdbTvSeasonEpisodes(s.tmdbBearer!, tmdbCtx.id, tvSeason);
          const eps = (data.episodes||[]).map((e:any)=>({
            id: `tmdb:tv:${tmdbCtx.id}:s${tvSeason}e${e.episode_number}`,
            title: e.name,
            overview: e.overview,
            image: tmdbImage(e.still_path,'w780'),
            duration: Math.round((e.runtime||0)),
            progress: 0,
          }));
          setEpisodes(eps);
        }
      } catch (e) { console.error(e); }
    }
    loadEps();
  }, [seasonKey]);

  const tabs = seasons.length > 0 ? ['EPISODES','RECOMMENDATIONS','INFO','REVIEWS'] : ['RECOMMENDATIONS','INFO','REVIEWS'];
  const playSelected = async () => {
    try {
      if (plexWatch) {
        const base = plexWatch.split('/library/parts/')[0];
        const partId = (activeVersion && versionPartMap[activeVersion]) || plexWatch.match(/\/library\/parts\/(\d+)/)?.[1];
        const tail = plexWatch.replace(/^[^?]+/, '');
        const url = partId ? `${base}/library/parts/${partId}/stream${tail}` : plexWatch;
        await watchOnPlex(url);
      } else {
        nav(`/player/${id}`);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="bg-app-gradient">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {/* Hero billboard full-bleed */}
      <div className="bleed relative h-[64vh] md:h-[72vh]">
        {/* Background masked to fade bottom */}
        <div className="hero-bg">
          <img src={backdrop || `https://picsum.photos/seed/details-${id}/1600/900`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${showTrailer? 'opacity-0':'opacity-100'}`} />
          <div className="hero-overlay" />
          {(plexTrailerUrl || trailerKey) && (
            <div className="absolute inset-0 opacity-40 pointer-events-none">
              {plexTrailerUrl ? (
                <video id="plex-trailer" className="w-full h-full object-cover" src={plexTrailerUrl} autoPlay muted={trailerMuted} loop playsInline />
              ) : trailerKey ? (
                <iframe id="yt-trailer" className="w-full h-full" src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${trailerMuted?1:0}&controls=0&loop=1&playsinline=1&rel=0&showinfo=0&modestbranding=1&playlist=${trailerKey}&enablejsapi=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" />
              ) : null}
            </div>
          )}
        </div>
        {(plexTrailerUrl || trailerKey) && (
          <button className="hero-mute z-20" onClick={() => toggleMute()} title={trailerMuted? 'Unmute trailer':'Mute trailer'}>
            {trailerMuted ? '🔇' : '🔊'}
          </button>
        )}
        <div className="absolute bottom-0 left-0 right-0 pb-8 z-20">
          <div className="page-gutter">
            <div className="flex gap-6 items-end">
              <div className="hidden md:block w-[240px] md:w-[280px] -mb-6">
                <div className="rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
                  {poster ? <img src={poster} className="w-full h-auto object-cover" /> : <div className="aspect-[2/3] bg-neutral-800" />}
                </div>
              </div>
              <div className="flex-1 hero-info">
                <div className="hero-scrim" />
                <div className="hero-content hero-grid">
                  {/* Left column */}
                  <div className="hero-col-left">
                    <div className="text-xs tracking-wide text-brand mb-1">{kind==='movie' ? 'MOVIE' : (kind==='tv' ? 'TV SERIES' : 'TITLE')}</div>
                    {logoUrl ? (
                      <img src={logoUrl} alt={title} className="h-16 md:h-20 object-contain mb-3 drop-shadow-[0_6px_24px_rgba(0,0,0,.6)]" />
                    ) : (
                      <h1 className="text-5xl md:text-7xl font-extrabold mb-3 title-shadow">{title}</h1>
                    )}
                    <div className="flex gap-2 mb-4 items-center">
                      {plexWatch ? (
                        <button onClick={playSelected} className="cta-primary">Play</button>
                      ) : (
                        <button onClick={() => nav(`/player/${id}`)} className="cta-primary">Play</button>
                      )}
                      <button className="cta-ghost" title="Add to My List">Add</button>
                      <button className="cta-ghost" title="Mark Watched">Watched</button>
                    </div>
                    <div className="text-sm text-neutral-300 mb-3 flex flex-wrap items-center gap-2">
                      {year && <span className="chip">{year}</span>}
                      {meta.runtime ? <span className="chip">{meta.runtime} min</span> : null}
                      {meta.rating && <span className="chip">{meta.rating}</span>}
                      {badges.map((b)=> <span key={b} className="chip">{b}</span>)}
                    </div>
                    {overview && <p className="max-w-3xl text-neutral-300 mb-2">{overview}</p>}
                    {/* Media info toggle if we have Plex tech */}
                    {versions.length>0 && (
                      <div className="mt-2">
                        <button className="text-sm text-neutral-300 hover:text-white underline" onClick={()=> setShowMediaInfo(v=>!v)}>
                          {showMediaInfo ? 'Hide media info' : 'Show media info'}
                        </button>
                        {showMediaInfo && (
                          <div className="mt-2 text-sm text-neutral-300">
                            {/* Version tabs */}
                            {versionDetails.length>0 && (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {versionDetails.map(v => (
                                  <button key={v.id} onClick={()=> { setInfoVersion(v.id); setActiveVersion(v.id); setAudioTracks(v.audios); setSubtitleTracks(v.subs); }}
                                    className={`h-8 px-3 rounded-full text-xs ring-1 ${infoVersion===v.id? 'bg-white text-black ring-white/0':'bg-white/5 text-neutral-200 hover:bg-white/10 ring-white/10'}`}
                                  >{v.label}</button>
                                ))}
                              </div>
                            )}
                            <div className="mb-2">
                              <span className="meta-label mr-2">Audio:</span>
                              {(versionDetails.find(v=>v.id===infoVersion)?.audios || audioTracks || []).map((a:any,i:number)=> <span key={i} className="chip">{a.label}</span>)}
                            </div>
                            <div className="mb-2">
                              <span className="meta-label mr-2">Subtitles:</span>
                              {(versionDetails.find(v=>v.id===infoVersion)?.subs || subtitleTracks || []).map((s:any,i:number)=> <span key={i} className="chip">{s.label}</span>)}
                            </div>
                            <TechnicalChips info={(versionDetails.find(v=>v.id===infoVersion)?.tech) || {
                              rating: meta.rating,
                              runtimeMin: meta.runtime,
                              videoCodec: tech.videoCodec, videoProfile: tech.videoProfile, resolution: tech.resolution,
                              bitrateKbps: tech.bitrateKbps, audioCodec: tech.audioCodec, audioChannels: tech.audioChannels,
                              fileSizeMB: tech.fileSizeMB, subsCount: tech.subsCount,
                            }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Right column */}
                  <div className="hero-col-right right-list hidden md:block md:absolute md:right-6 md:bottom-4 md:max-w-[40vw]">
                    {cast.length>0 && (
                      <div className="mb-3">
                        <div className="meta-label mb-1">Cast</div>
                        <div className="flex flex-wrap gap-2 max-w-xl">
                          {cast.slice(0,6).map((c,i)=>(
                            <button key={i} onClick={()=> { setPersonId(c.id); setPersonName(c.name); setPersonOpen(true); }} className="underline text-neutral-200 hover:text-white">
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {meta.genres && meta.genres.length>0 && (
                      <div className="mb-3">
                        <div className="meta-label mb-1">Genres</div>
                        <div className="flex flex-wrap gap-2">
                          {meta.genres.map((g,i)=>(<span key={i} className="chip">{g}</span>))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      <div className="page-gutter py-6 space-y-6">
        {seasons.length>0 && (
          <div className="flex items-center gap-3">
            <div className="text-sm text-neutral-400">Season</div>
            <select className="input w-40" value={seasonKey} onChange={(e)=> setSeasonKey(e.target.value)}>
              {seasons.map(s=> <option key={s.key} value={s.key}>{s.title}</option>)}
            </select>
          </div>
        )}
        {/* Below-hero meta block removed to prevent duplicate info */}
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        {activeTab==='EPISODES' && seasons.length>0 && (
          <section className="mt-4 space-y-3">
            {episodes.length ? episodes.map((e:any, idx:number)=> (
              <EpisodeItem key={e.id||idx} ep={{...e, index: idx+1}} onClick={(eid)=> nav(`/player/${encodeURIComponent(eid)}`)} />
            )) : <EpisodeSkeletonList />}
          </section>
        )}
        {activeTab==='RECOMMENDATIONS' && (
          <section className="mt-4">
            {related.length>0 ? (
              <>
                <Row
                  title="Recommendations"
                  items={related as any}
                  browseKey={tmdbCtx?.id ? `tmdb:recs:${tmdbCtx.media}:${tmdbCtx.id}` : undefined}
                  onItemClick={(id)=> nav(`/details/${encodeURIComponent(id)}`)}
                />
                {similar.length>0 && (
                  <Row
                    title="More Like This"
                    items={similar as any}
                    browseKey={tmdbCtx?.id ? `tmdb:similar:${tmdbCtx.media}:${tmdbCtx.id}` : undefined}
                    onItemClick={(id)=> nav(`/details/${encodeURIComponent(id)}`)}
                  />
                )}
              </>
            ) : <SkeletonRow />}
          </section>
        )}
        {activeTab==='INFO' && (
          <section className="mt-4">
            <TechnicalChips info={{
              rating: meta.rating,
              runtimeMin: meta.runtime,
              videoCodec: tech.videoCodec, videoProfile: tech.videoProfile, resolution: tech.resolution,
              bitrateKbps: tech.bitrateKbps, audioCodec: tech.audioCodec, audioChannels: tech.audioChannels,
              fileSizeMB: tech.fileSizeMB, subsCount: tech.subsCount,
            }} />
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Cast</h2>
              <div className="flex gap-3  no-scrollbar">
                {cast.length ? cast.map((c, i) => (
                  <button key={i} onClick={()=> { setPersonId(c.id); setPersonName(c.name); setPersonOpen(true); }} className="flex-shrink-0 w-28 text-center">
                    <div className="w-28 h-28 rounded-full overflow-hidden bg-neutral-800 mb-1">
                      {c.img ? <img src={c.img} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="text-sm">{c.name}</div>
                  </button>
                )) : Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-28 text-center">
                    <div className="w-28 h-28 rounded-full overflow-hidden bg-neutral-800 mb-1" />
                    <div className="text-sm">Actor {i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        {activeTab==='REVIEWS' && (
          <section className="mt-4 page-gutter text-neutral-400">Reviews coming soon.</section>
        )}
      </div>
      <PersonModal open={personOpen} onClose={()=> setPersonOpen(false)} personId={personId} name={personName} tmdbKey={loadSettings().tmdbBearer} />
      <BrowseModal />
    </div>
  );
}

async function watchOnPlex(url: string) {
  try {
    // @ts-ignore
    if (window.__TAURI__) {
      // @ts-ignore
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('player_open', { url });
      await invoke('player_play');
      return;
    }
    // Fallback: open in a new tab
    window.open(url, '_blank');
  } catch (e) { console.error(e); }
}

function openPerson(c: { id?: string; name: string }) {
  if (c.id) {
    window.history.pushState({}, '', `/person/${encodeURIComponent(c.id)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    window.history.pushState({}, '', `/person?name=${encodeURIComponent(c.name)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function toggleMute() {
  // Prefer toggling HTML5 video if present
  const vid = document.getElementById('plex-trailer') as HTMLVideoElement | null;
  if (vid) {
    vid.muted = !vid.muted;
    const root = (window as any).reactSetTrailerMuted as ((v:boolean)=>void)|undefined;
    if (root) root(vid.muted);
    return;
  }
  const iframe = document.getElementById('yt-trailer') as HTMLIFrameElement | null;
  if (!iframe || !iframe.contentWindow) return;
  try {
    // Toggle mute via YouTube Iframe API postMessage
    const muted = !(window as any)._ytMuted;
    (window as any)._ytMuted = muted;
    const msg = JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: [] });
    iframe.contentWindow.postMessage(msg, '*');
    // Also reflect in React state
    const root = (window as any).reactSetTrailerMuted as ((v:boolean)=>void)|undefined;
    if (root) root(muted);
  } catch (e) { console.error(e); }
}
