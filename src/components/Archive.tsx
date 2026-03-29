import { useState, useEffect, useCallback, useRef } from 'react';
import type { FeatureCollection } from 'geojson';
import MapPane from './MapPane';
import CollectionPane from './CollectionPane';
import AboutPane from './AboutPane';

const R2_BASE = 'https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev';
const METADATA_URL = import.meta.env.DEV ? '/api/metadata.json' : `${R2_BASE}/metadata.json`;
const FOOTPRINTS_URL = import.meta.env.DEV ? '/api/footprints.json' : `${R2_BASE}/footprints.json`;

const MIN_PANE_PCT = 15;
const MAX_PANE_PCT = 85;

export interface ImageRecord {
  id: string;
  is_georeferenced: boolean;
  bounds: [number, number, number, number] | null;
  original_jpg: string;
  geo_webp?: string;
  thumb_jpg: string;
  place_name_original: string;
  place_name_current: string;
  date: string;
  flight_id: string;
  notes: string;
  [key: string]: unknown;
}

function readUrlParam(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

export default function Archive() {
  const [images, setImages] = useState<ImageRecord[] | null>(null);
  const [footprints, setFootprints] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(() => readUrlParam('id'));
  const [splitPct, setSplitPct] = useState(50);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [rightPaneView, setRightPaneView] = useState<'collection' | 'about'>('collection');

  const prevSplitRef = useRef(50);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch metadata + footprints
  useEffect(() => {
    Promise.all([
      fetch(METADATA_URL).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(FOOTPRINTS_URL).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    ])
      .then(([data, fp]) => {
        setImages(data as ImageRecord[]);
        setFootprints(fp as FeatureCollection);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Sync selectedId to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedId) {
      params.set('id', selectedId);
    } else {
      params.delete('id');
    }
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    history.replaceState(null, '', url);
  }, [selectedId]);

  // Drag handling
  const onMouseDown = useCallback(() => {
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(MAX_PANE_PCT, Math.max(MIN_PANE_PCT, pct));
      setSplitPct(clamped);
      prevSplitRef.current = clamped;
    };

    const onMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  // Collapse handlers
  const toggleLeft = useCallback(() => {
    setLeftCollapsed((prev) => {
      if (prev) setSplitPct(prevSplitRef.current);
      return !prev;
    });
  }, []);

  const toggleRight = useCallback(() => {
    setRightCollapsed((prev) => {
      if (prev) setSplitPct(prevSplitRef.current);
      return !prev;
    });
  }, []);

  const handleSelectImage = useCallback((id: string | null) => {
    setSelectedId((prev) => (id !== null && prev === id ? null : id));
  }, []);

  const handleFocusMap = useCallback((id: string) => {
    setSelectedId(id);
    setFocusTrigger((n) => n + 1);
  }, []);

  // Loading / error states
  if (error) {
    return <div className="archive--error">Failed to load archive: {error}</div>;
  }
  if (!images || !footprints) {
    return (
      <div className="archive">
        <div className="pane" style={{ width: '50%' }}>
          <div className="pane__header"><span className="pane__title">Map</span></div>
          <div className="pane__loading"><div className="spinner" /></div>
        </div>
        <div className="drag-handle" style={{ pointerEvents: 'none' }} />
        <div className="pane" style={{ width: '50%' }}>
          <div className="pane__header"><span className="pane__title">Collection</span></div>
          <div className="pane__loading"><div className="spinner" /></div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`archive${dragging ? ' archive--dragging' : ''}`}
    >
      {/* Left pane: Map */}
      <div
        className={`pane${leftCollapsed ? ' pane--collapsed' : ''}`}
        style={
          leftCollapsed
            ? undefined
            : { width: rightCollapsed ? '100%' : `${splitPct}%` }
        }
        onClick={leftCollapsed ? toggleLeft : undefined}
      >
        <div className="pane__collapsed-bar">
          <span>Map</span>
        </div>
        <div className="pane__header">
          <span className="pane__title pane__title--site">The Palmach Aerial Collection Explorer</span>
        </div>
        <MapPane
          images={images}
          footprints={footprints}
          selectedId={selectedId}
          onSelectImage={handleSelectImage}
          focusTrigger={focusTrigger}
        />
      </div>

      {/* Drag handle — hidden when either pane is collapsed */}
      {!leftCollapsed && !rightCollapsed && (
        <div
          className={`drag-handle${dragging ? ' drag-handle--active' : ''}`}
          onMouseDown={onMouseDown}
        />
      )}

      {/* Right pane: Collection */}
      <div
        className={`pane${rightCollapsed ? ' pane--collapsed' : ''}`}
        style={
          rightCollapsed
            ? undefined
            : { width: leftCollapsed ? '100%' : `${100 - splitPct}%` }
        }
        onClick={rightCollapsed ? toggleRight : undefined}
      >
        <div className="pane__collapsed-bar">
          <span>Collection</span>
        </div>
        <div className="pane__header">
          <div className="pane__tabs">
            <button
              className={`pane__tab${rightPaneView === 'collection' ? ' pane__tab--active' : ''}`}
              onClick={() => setRightPaneView('collection')}
            >
              Collection
            </button>
            <span className="pane__tab-sep">/</span>
            <button
              className={`pane__tab${rightPaneView === 'about' ? ' pane__tab--active' : ''}`}
              onClick={() => setRightPaneView('about')}
            >
              About
            </button>
          </div>
        </div>
        {rightPaneView === 'collection' ? (
          <CollectionPane
            images={images}
            selectedId={selectedId}
            onSelectImage={handleSelectImage}
            onFocusMap={handleFocusMap}
          />
        ) : (
          <AboutPane />
        )}
      </div>
    </div>
  );
}
