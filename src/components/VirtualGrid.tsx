import { useMemo, useRef, useState, useEffect } from 'react';

type Item = { id: string; title: string; image?: string; subtitle?: string; badge?: string };

export default function VirtualGrid({ items, rowHeight = 280, columnWidth = 160, gap = 12, render, hasMore, loadMore }: {
  items: Item[];
  rowHeight?: number;
  columnWidth?: number;
  gap?: number;
  render: (item: Item) => JSX.Element;
  hasMore?: boolean;
  loadMore?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current!;
    function onScroll() { setScrollTop(el.scrollTop); }
    function onResize() {
      setHeight(el.clientHeight);
      setContainerWidth(el.clientWidth);
    }
    onResize();
    el.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, []);

  const columnCount = useMemo(() => {
    const w = containerWidth;
    return Math.max(1, Math.floor((w + gap) / (columnWidth + gap)));
  }, [containerWidth, columnWidth, gap]);

  const rowCount = Math.ceil(items.length / columnCount);
  const startRow = Math.max(0, Math.floor(scrollTop / (rowHeight + gap)) - 2);
  const endRow = Math.min(rowCount, Math.ceil((scrollTop + height) / (rowHeight + gap)) + 2);

  const visibleItems = useMemo(() => {
    const out: Array<{ item: Item; style: React.CSSProperties; key: string }> = [];
    for (let r = startRow; r < endRow; r++) {
      for (let c = 0; c < columnCount; c++) {
        const idx = r * columnCount + c;
        const item = items[idx];
        if (!item) break;
        out.push({
          item,
          key: item.id,
          style: {
            position: 'absolute',
            top: r * (rowHeight + gap),
            left: c * (columnWidth + gap),
            width: columnWidth,
            height: rowHeight,
          },
        });
      }
    }
    return out;
  }, [items, startRow, endRow, columnCount, rowHeight, gap, columnWidth]);

  return (
    <div ref={containerRef} className="relative overflow-auto" style={{ height: 'calc(100vh - 140px)' }}>
      <div style={{ position: 'relative', height: rowCount * (rowHeight + gap), margin: gap / 2 }}>
        {visibleItems.map(({ item, style, key }) => (
          <div key={key} style={style}>{render(item)}</div>
        ))}
      </div>
      {hasMore && (
        <InfiniteSentinel onVisible={() => loadMore?.()} />
      )}
    </div>
  );
}

function InfiniteSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) onVisible();
    }, { root: el.parentElement as Element, rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible]);
  return <div ref={ref} style={{ position: 'absolute', bottom: 0, height: 1, width: '100%' }} />;
}
