import LandscapeCard from './LandscapeCard';
import ContinueCard from './ContinueCard';
import { useSearchParams } from 'react-router-dom';

type Item = { id: string; title: string; image: string; badge?: string; progress?: number };

export default function Row({ title, items, variant = 'default', onItemClick, browseKey }: {
  title: string;
  items: Item[];
  variant?: 'default' | 'continue';
  onItemClick?: (id: string) => void;
  browseKey?: string;
}) {
  const [params, setParams] = useSearchParams();
  return (
    <section className="py-2 my-5">
      <div className="page-gutter">
        <div className="row-band">
          <div className="pt-4">
            <div className="flex items-baseline gap-3 group">
              <h2 className="text-neutral-200 font-semibold text-xl md:text-2xl cursor-default">{title}</h2>
              {browseKey && (
                <button
                  onClick={() => { params.set('bkey', browseKey); setParams(params, { replace: false }); }}
                  className="flex items-center gap-1 text-sm text-neutral-300 hover:text-white opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-500 ease-out"
                  title="Browse"
                >
                  <span>Browse</span>
                  <span aria-hidden>›</span>
                </button>
              )}
            </div>
          </div>
          <div className="row-edge no-scrollbar overflow-x-auto" style={{ padding: '12px 0 16px 0' }}>
            <div className="flex gap-4 pb-4 w-max">
              
              {items.map((i) => variant === 'continue' ? (
                <ContinueCard key={i.id} id={i.id} title={i.title} image={i.image!} progress={i.progress ?? 0} onClick={(id) => onItemClick?.(id)} />
              ) : (
                <LandscapeCard key={i.id} id={i.id} title={i.title} image={i.image!} badge={i.badge} onClick={() => onItemClick?.(i.id)} />
              ))}
              
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
