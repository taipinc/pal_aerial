import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ImageRecord } from './Archive';

type ViewMode = 'grid' | 'table';
type GeoFilter = 'all' | 'geo' | 'nogeo';
type SortKey = 'place_name_original' | 'place_name_current' | 'date' | 'flight_id' | 'is_georeferenced';
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
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Prev / Next in filtered set
  const selectedIndex = sorted.findIndex((img) => img.id === selectedId);
  const goPrev = useCallback(() => {
    if (selectedIndex > 0) onSelectImage(sorted[selectedIndex - 1].id);
  }, [selectedIndex, sorted, onSelectImage]);
  const goNext = useCallback(() => {
    if (selectedIndex < sorted.length - 1) onSelectImage(sorted[selectedIndex + 1].id);
  }, [selectedIndex, sorted, onSelectImage]);

  const selectedImage = selectedId ? images.find((img) => img.id === selectedId) : null;

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
      <div className="collection__body" ref={scrollRef}>
        {viewMode === 'grid' ? (
          <GridView
            images={sorted}
            selectedId={selectedId}
            selectedImage={selectedImage}
            onSelectImage={onSelectImage}
            onFocusMap={onFocusMap}
            goPrev={goPrev}
            goNext={goNext}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < sorted.length - 1}
          />
        ) : (
          <TableView
            images={sorted}
            selectedId={selectedId}
            selectedImage={selectedImage}
            onSelectImage={onSelectImage}
            onFocusMap={onFocusMap}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            goPrev={goPrev}
            goNext={goNext}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < sorted.length - 1}
          />
        )}
      </div>
    </div>
  );
}

/* ── Grid View ── */

interface GridViewProps {
  images: ImageRecord[];
  selectedId: string | null;
  selectedImage: ImageRecord | null | undefined;
  onSelectImage: (id: string | null) => void;
  onFocusMap: (id: string) => void;
  goPrev: () => void;
  goNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function GridView({ images, selectedId, selectedImage, onSelectImage, onFocusMap, goPrev, goNext, hasPrev, hasNext }: GridViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [colCount, setColCount] = useState(5);

  // Measure column count from the actual grid layout
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(' ').length;
      setColCount(cols);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Find selected index and compute where to insert the expanded panel (after the row ends)
  const selectedIndex = selectedId ? images.findIndex((img) => img.id === selectedId) : -1;
  const insertAfterIndex = selectedIndex >= 0
    ? Math.min(Math.floor(selectedIndex / colCount) * colCount + colCount - 1, images.length - 1)
    : -1;

  return (
    <div className="grid-view" ref={gridRef}>
      {images.map((img, i) => (
        <React.Fragment key={img.id}>
          <div
            className={`grid-card${img.id === selectedId ? ' grid-card--selected' : ''}`}
            onClick={() => onSelectImage(img.id)}
          >
            <div className="grid-card__thumb-wrap">
              {img.thumb_jpg ? (
                <img src={img.thumb_jpg} alt={displayName(img)} className="grid-card__thumb" loading="lazy" />
              ) : (
                <div className="grid-card__placeholder" />
              )}
              {img.is_georeferenced && <span className="grid-card__badge">GEO</span>}
            </div>
            <div className="grid-card__info">
              <span className="grid-card__name">{displayName(img)}</span>
              {img.date && <span className="grid-card__date">{img.date}</span>}
            </div>
          </div>
          {i === insertAfterIndex && selectedImage && (
            <ExpandedItem
              image={selectedImage}
              onClose={() => onSelectImage(null)}
              onFocusMap={onFocusMap}
              goPrev={goPrev}
              goNext={goNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Table View ── */

interface TableViewProps {
  images: ImageRecord[];
  selectedId: string | null;
  selectedImage: ImageRecord | null | undefined;
  onSelectImage: (id: string | null) => void;
  onFocusMap: (id: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  goPrev: () => void;
  goNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

const TABLE_COLS: { key: SortKey; label: string }[] = [
  { key: 'place_name_original', label: 'Original name' },
  { key: 'place_name_current', label: 'Current name' },
  { key: 'date', label: 'Date' },
  { key: 'flight_id', label: 'Flight' },
  { key: 'is_georeferenced', label: 'Georef' },
];

function TableView({ images, selectedId, selectedImage, onSelectImage, onFocusMap, sortKey, sortDir, onSort, goPrev, goNext, hasPrev, hasNext }: TableViewProps) {
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
          <React.Fragment key={img.id}>
            <tr
              className={`table-view__row${img.id === selectedId ? ' table-view__row--selected' : ''}`}
              onClick={() => onSelectImage(img.id)}
            >
              <td className="table-view__td table-view__td--thumb">
                {img.thumb_jpg ? (
                  <img src={img.thumb_jpg} alt="" className="table-view__thumb" loading="lazy" />
                ) : (
                  <div className="table-view__thumb-placeholder" />
                )}
              </td>
              <td className="table-view__td">{img.place_name_original}</td>
              <td className="table-view__td">{img.place_name_current}</td>
              <td className="table-view__td">{img.date}</td>
              <td className="table-view__td">{img.flight_id}</td>
              <td className="table-view__td">{img.is_georeferenced ? '✓' : ''}</td>
            </tr>
            {img.id === selectedId && selectedImage && (
              <tr className="table-view__expanded-row">
                <td colSpan={6}>
                  <ExpandedItem
                    image={selectedImage}
                    onClose={() => onSelectImage(null)}
                    onFocusMap={onFocusMap}
                    goPrev={goPrev}
                    goNext={goNext}
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                  />
                </td>
              </tr>
            )}
          </React.Fragment>
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

function ExpandedItem({ image, onClose, onFocusMap, goPrev, goNext, hasPrev, hasNext }: ExpandedItemProps) {
  const [showGeo, setShowGeo] = useState(false);
  const [copied, setCopied] = useState(false);

  // Zoom/pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const viewerRef = useRef<HTMLDivElement>(null);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setShowGeo(false);
    setCopied(false);
  }, [image.id]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(6, Math.max(1, s - e.deltaY * 0.002)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
  }, [scale, translate]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setTranslate({
        x: translateStart.current.x + (e.clientX - dragStart.current.x),
        y: translateStart.current.y + (e.clientY - dragStart.current.y),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Metadata original_jpg has wrong extension (.jpg) — actual files are .webp
  const originalUrl = `https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev/originals/${image.id}.webp`;
  const imgSrc = showGeo && image.geo_webp ? image.geo_webp : originalUrl;

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
          ref={viewerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        >
          <img
            src={imgSrc}
            alt={displayName(image)}
            className="expanded__image"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            }}
            draggable={false}
          />
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

/* React import is auto-injected by the JSX transform, but Fragment needs it explicit in some configs */
import React from 'react';
