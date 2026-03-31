import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import React from 'react';
import type { ImageRecord } from './Archive';

type ViewMode = 'grid' | 'table';
type GeoFilter = 'all' | 'geo' | 'nogeo';
type SortKey = 'id' | 'date' | 'flight_id' | 'is_georeferenced';
type SortDir = 'asc' | 'desc';

interface CollectionPaneProps {
  images: ImageRecord[];
  selectedId: string | null;
  onSelectImage: (id: string | null) => void;
  onFocusMap: (id: string) => void;
}

function readParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

function updateUrlParam(key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value);
  else params.delete(key);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
}

function displayName(img: ImageRecord): string {
  return img.place_name_current || img.place_name_original || img.id;
}

export default function CollectionPane({ images, selectedId, onSelectImage, onFocusMap }: CollectionPaneProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => (readParam('view') as ViewMode) || 'grid');
  const [searchRaw, setSearchRaw] = useState(() => readParam('q') || '');
  const [searchQuery, setSearchQuery] = useState(searchRaw);
  const [geoFilter, setGeoFilter] = useState<GeoFilter>('all');
  const [flightFilter, setFlightFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  // Sync URL params
  useEffect(() => { updateUrlParam('view', viewMode === 'grid' ? null : viewMode); }, [viewMode]);
  useEffect(() => { updateUrlParam('q', searchQuery || null); }, [searchQuery]);

  // Unique flight IDs
  const flightIds = useMemo(() => {
    const ids = new Set<string>();
    for (const img of images) {
      if (img.flight_id) ids.add(img.flight_id);
    }
    return Array.from(ids).sort();
  }, [images]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return images.filter((img) => {
      if (q) {
        const hay = `${img.place_name_original} ${img.place_name_current} ${img.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (geoFilter === 'geo' && !img.is_georeferenced) return false;
      if (geoFilter === 'nogeo' && img.is_georeferenced) return false;
      if (flightFilter && img.flight_id !== flightFilter) return false;
      return true;
    });
  }, [images, searchQuery, geoFilter, flightFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: string | boolean = a[sortKey] as string | boolean;
      let bv: string | boolean = b[sortKey] as string | boolean;
      if (typeof av === 'boolean') { av = av ? '1' : '0'; bv = bv ? '1' : '0'; }
      av = av || '';
      bv = bv || '';
      const cmp = (av as string).localeCompare(bv as string);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const isFiltered = searchQuery || geoFilter !== 'all' || flightFilter;

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchRaw('');
    setSearchQuery('');
    setGeoFilter('all');
    setFlightFilter('');
  }, []);

  // Prev / Next
  const selectedIndex = sorted.findIndex((img) => img.id === selectedId);
  const goPrev = useCallback(() => {
    if (selectedIndex > 0) onSelectImage(sorted[selectedIndex - 1].id);
  }, [selectedIndex, sorted, onSelectImage]);
  const goNext = useCallback(() => {
    if (selectedIndex < sorted.length - 1) onSelectImage(sorted[selectedIndex + 1].id);
  }, [selectedIndex, sorted, onSelectImage]);

  const selectedImage = selectedId ? images.find((img) => img.id === selectedId) : null;

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxSrc]);

  // Keyboard nav for expanded panel (disabled when lightbox is open)
  useEffect(() => {
    if (!selectedImage || lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectImage(null);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedImage, lightboxSrc, goPrev, goNext, onSelectImage]);

  return (
    <div className="collection">
      {/* Filter bar */}
      <div className="collection__filters">
        <div className="collection__filter-row">
          <input
            type="text"
            className="collection__search"
            placeholder="Search places, notes…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
          />
          <div className="collection__view-toggle">
            <button
              className={`collection__view-btn${viewMode === 'grid' ? ' collection__view-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              ▦
            </button>
            <button
              className={`collection__view-btn${viewMode === 'table' ? ' collection__view-btn--active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              ☰
            </button>
          </div>
        </div>
        <div className="collection__filter-row">
          <div className="collection__geo-toggle">
            {(['all', 'geo', 'nogeo'] as GeoFilter[]).map((val) => (
              <button
                key={val}
                className={`collection__geo-btn${geoFilter === val ? ' collection__geo-btn--active' : ''}`}
                onClick={() => setGeoFilter(val)}
              >
                {val === 'all' ? 'All' : val === 'geo' ? 'Georef' : 'No georef'}
              </button>
            ))}
          </div>
          {flightIds.length > 0 && (
            <select
              className="collection__flight-select"
              value={flightFilter}
              onChange={(e) => setFlightFilter(e.target.value)}
            >
              <option value="">All flights</option>
              {flightIds.map((fid) => (
                <option key={fid} value={fid}>{fid}</option>
              ))}
            </select>
          )}
          {isFiltered && (
            <button className="collection__clear-btn" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="collection__count">
        {isFiltered
          ? `Showing ${sorted.length} of ${images.length} images`
          : `${images.length} images`}
      </div>

      {/* Content */}
      <div className="collection__body" onClick={() => onSelectImage(null)}>
        {sorted.length === 0 ? (
          <div className="collection__empty" onClick={(e) => e.stopPropagation()}>
            <span>No images match your filters.</span>
            {isFiltered && (
              <button className="collection__empty-btn" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <GridView
            images={sorted}
            selectedId={selectedId}
            onSelectImage={onSelectImage}
          />
        ) : (
          <TableView
            images={sorted}
            selectedId={selectedId}
            onSelectImage={onSelectImage}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
      </div>

      {/* Expanded item panel */}
      {selectedImage && (
        <div className="collection__expanded-panel" onClick={(e) => e.stopPropagation()}>
          <ExpandedItem
            image={selectedImage}
            onClose={() => onSelectImage(null)}
            onFocusMap={onFocusMap}
            onLightbox={setLightboxSrc}
            goPrev={goPrev}
            goNext={goNext}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < sorted.length - 1}
          />
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="" className="lightbox__image" />
          <button className="lightbox__close">✕</button>
        </div>
      )}
    </div>
  );
}

/* ── Grid View ── */

interface GridViewProps {
  images: ImageRecord[];
  selectedId: string | null;
  onSelectImage: (id: string | null) => void;
}

const CARD_HEIGHT_ESTIMATE = 200; // px including gap, used before measurement
const SCROLL_BUFFER = 500; // px above/below viewport to keep rendered

function GridView({ images, selectedId, onSelectImage }: GridViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [colCount, setColCount] = useState(5);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_ESTIMATE);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerH, setContainerH] = useState(600);

  // Measure columns and card height
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(' ').length;
      setColCount(cols);
      const card = el.querySelector<HTMLElement>('.grid-card');
      if (card) {
        const h = card.getBoundingClientRect().height;
        if (h > 10) setCardHeight(h + 8); // +8 for gap
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track scroll position on parent container
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const scrollEl = grid.parentElement;
    if (!scrollEl) return;

    const onScroll = () => setScrollTop(scrollEl.scrollTop);
    const ro = new ResizeObserver(() => {
      setContainerH(scrollEl.clientHeight);
      setScrollTop(scrollEl.scrollTop);
    });

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(scrollEl);
    setContainerH(scrollEl.clientHeight);

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  // Compute visible window
  const rowCount = Math.ceil(images.length / colCount);
  const firstRow = Math.max(0, Math.floor((scrollTop - SCROLL_BUFFER) / cardHeight));
  const lastRow = Math.min(rowCount - 1, Math.ceil((scrollTop + containerH + SCROLL_BUFFER) / cardHeight));

  const startIdx = firstRow * colCount;
  const endIdx = Math.min(images.length, (lastRow + 1) * colCount);
  const topSpacerH = firstRow * cardHeight;
  const bottomSpacerH = Math.max(0, rowCount - lastRow - 1) * cardHeight;

  return (
    <div className="grid-view" ref={gridRef}>
      {topSpacerH > 0 && (
        <div style={{ gridColumn: '1 / -1', height: `${topSpacerH}px` }} aria-hidden="true" />
      )}
      {images.slice(startIdx, endIdx).map((img) => (
        <div
          key={img.id}
          className={`grid-card${img.id === selectedId ? ' grid-card--selected' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSelectImage(img.id); }}
        >
          <div className="grid-card__thumb-wrap">
            {img.thumb_jpg ? (
              <img
                src={img.thumb_jpg}
                alt={displayName(img)}
                className="grid-card__thumb"
                loading="lazy"
              />
            ) : (
              <div className="grid-card__placeholder">{img.id}</div>
            )}
            {img.is_georeferenced && <span className="grid-card__badge">GEO</span>}
          </div>
          <div className="grid-card__info">
            <span className="grid-card__name">{displayName(img)}</span>
            {img.date && <span className="grid-card__date">{img.date}</span>}
          </div>
        </div>
      ))}
      {bottomSpacerH > 0 && (
        <div style={{ gridColumn: '1 / -1', height: `${bottomSpacerH}px` }} aria-hidden="true" />
      )}
    </div>
  );
}

/* ── Table View ── */

interface TableViewProps {
  images: ImageRecord[];
  selectedId: string | null;
  onSelectImage: (id: string | null) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

const TABLE_COLS: { key: SortKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'date', label: 'Date' },
  { key: 'flight_id', label: 'Flight' },
  { key: 'is_georeferenced', label: 'Georef' },
];

function TableView({ images, selectedId, onSelectImage, sortKey, sortDir, onSort }: TableViewProps) {
  return (
    <table className="table-view">
      <thead>
        <tr>
          <th className="table-view__th table-view__th--thumb"></th>
          {TABLE_COLS.map((col) => (
            <th
              key={col.key}
              className={`table-view__th${sortKey === col.key ? ' table-view__th--sorted' : ''}`}
              onClick={() => onSort(col.key)}
            >
              {col.label}
              {sortKey === col.key && (
                <span className="table-view__sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {images.map((img) => (
          <tr
            key={img.id}
            className={`table-view__row${img.id === selectedId ? ' table-view__row--selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); onSelectImage(img.id); }}
          >
            <td className="table-view__td table-view__td--thumb">
              {img.thumb_jpg ? (
                <img src={img.thumb_jpg} alt="" className="table-view__thumb" loading="lazy" />
              ) : (
                <div className="table-view__thumb-placeholder" />
              )}
            </td>
            <td className="table-view__td">{img.id}</td>
            <td className="table-view__td">{img.date}</td>
            <td className="table-view__td">{img.flight_id}</td>
            <td className="table-view__td">{img.is_georeferenced ? '✓' : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Expanded Item ── */

interface ExpandedItemProps {
  image: ImageRecord;
  onClose: () => void;
  onFocusMap: (id: string) => void;
  onLightbox: (src: string) => void;
  goPrev: () => void;
  goNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

const META_FIELDS: { key: keyof ImageRecord; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'place_name_original', label: 'Original name' },
  { key: 'place_name_current', label: 'Current name' },
  { key: 'date', label: 'Date' },
  { key: 'flight_id', label: 'Flight ID' },
  { key: 'notes', label: 'Notes' },
];

function ExpandedItem({ image, onClose, onFocusMap, onLightbox, goPrev, goNext, hasPrev, hasNext }: ExpandedItemProps) {
  const [showGeo, setShowGeo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Touch/pointer zoom+pan state
  const imgRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastPinchDistRef = useRef(0);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    setShowGeo(false);
    setCopied(false);
    setImgError(false);
    transformRef.current = { scale: 1, x: 0, y: 0 };
    if (imgRef.current) imgRef.current.style.transform = '';
    activePointersRef.current.clear();
  }, [image.id]);

  const applyTransform = useCallback((scale: number, x: number, y: number) => {
    transformRef.current = { scale, x, y };
    if (imgRef.current) {
      imgRef.current.style.transform = (scale === 1 && x === 0 && y === 0)
        ? ''
        : `translate(${x}px, ${y}px) scale(${scale})`;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    hasDraggedRef.current = false;
    if (activePointersRef.current.size === 2) {
      const [p1, p2] = [...activePointersRef.current.values()];
      lastPinchDistRef.current = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const prev = activePointersRef.current.get(e.pointerId);
    if (!prev) return;

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDraggedRef.current = true;

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { scale, x, y } = transformRef.current;

    if (activePointersRef.current.size === 1) {
      if (scale > 1) applyTransform(scale, x + dx, y + dy);
    } else if (activePointersRef.current.size === 2) {
      const [p1, p2] = [...activePointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (lastPinchDistRef.current > 0) {
        const ratio = dist / lastPinchDistRef.current;
        const newScale = Math.min(5, Math.max(1, scale * ratio));
        applyTransform(newScale, x, y);
      }
      lastPinchDistRef.current = dist;
    }
  }, [applyTransform]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) lastPinchDistRef.current = 0;
    const { scale } = transformRef.current;
    if (scale <= 1) applyTransform(1, 0, 0);
  }, [applyTransform]);

  const originalUrl = `https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev/originals/${image.id}.webp`;
  const imgSrc = showGeo && image.geo_webp ? image.geo_webp : originalUrl;

  const onViewerClick = useCallback(() => {
    if (!hasDraggedRef.current && !imgError) onLightbox(imgSrc);
  }, [imgSrc, onLightbox, imgError]);

  const copyPermalink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?id=${image.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [image.id]);

  return (
    <div className="expanded" onClick={(e) => e.stopPropagation()}>
      <div className="expanded__top-bar">
        <div className="expanded__nav">
          <button className="expanded__btn" onClick={goPrev} disabled={!hasPrev} title="Previous">◀ Prev</button>
          <button className="expanded__btn" onClick={goNext} disabled={!hasNext} title="Next">Next ▶</button>
        </div>
        <div className="expanded__actions">
          {image.geo_webp && (
            <button className="expanded__btn" onClick={() => setShowGeo((v) => !v)}>
              {showGeo ? 'Show original' : 'Show georeferenced'}
            </button>
          )}
          {image.is_georeferenced && image.bounds && (
            <button className="expanded__btn expanded__btn--accent" onClick={() => onFocusMap(image.id)}>
              Focus on map
            </button>
          )}
          <button className="expanded__btn" onClick={copyPermalink}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button className="expanded__close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      <div className="expanded__content">
        <div
          className="expanded__viewer"
          onClick={onViewerClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: 'none' }}
        >
          {imgError ? (
            <div className="expanded__img-placeholder">Image not available</div>
          ) : (
            <img
              ref={imgRef}
              src={imgSrc}
              alt={displayName(image)}
              className="expanded__image"
              draggable={false}
              onError={() => setImgError(true)}
            />
          )}
        </div>

        <div className="expanded__meta">
          <h3 className="expanded__title">{displayName(image)}</h3>
          <dl className="expanded__fields">
            {META_FIELDS.map(({ key, label }) => {
              const val = image[key];
              if (!val && val !== false) return null;
              return (
                <div key={key} className="expanded__field">
                  <dt>{label}</dt>
                  <dd>{String(val)}</dd>
                </div>
              );
            })}
            <div className="expanded__field">
              <dt>Georeferenced</dt>
              <dd>{image.is_georeferenced ? 'Yes' : 'No'}</dd>
            </div>
            {image.bounds && (
              <div className="expanded__field">
                <dt>Bounds</dt>
                <dd className="expanded__bounds">{image.bounds.join(', ')}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
