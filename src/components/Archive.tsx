import { useState, useEffect, useCallback, useRef } from 'react';
import MapPane from './MapPane';
import CollectionPane from './CollectionPane';

const R2_URL =
  'https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev/metadata.json';
const METADATA_URL =
  import.meta.env.DEV ? '/api/metadata.json' : R2_URL;

const MIN_PANE_PCT = 15;
const MAX_PANE_PCT = 85;

export interface ImageRecord {
  id: string;
  is_georeferenced: boolean;
  bounds: [number, number, number, number] | null;
  display_webp: string;
  geo_webp?: string;
  thumb_jpg: string;
  place_name_original: string;
  place_name_current: string;
  date: string;
  flight_id: string;
  notes: string;
  [key: string]: unknown;
}

export default function Archive() {
  const [images, setImages] = useState<ImageRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitPct, setSplitPct] = useState(50);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const prevSplitRef = useRef(50);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch metadata
  useEffect(() => {
    fetch(METADATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ImageRecord[]) => {
        setImages(data);
        console.log(`Loaded ${data.length} images from metadata.json`);
      })
      .catch((err) => setError(err.message));
  }, []);

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

  const handleSelectImage = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    console.log(`Selected image: ${id}`);
  }, []);

  // Loading / error states
  if (error) {
    return <div className="archive--error">Failed to load archive: {error}</div>;
  }
  if (!images) {
    return <div className="archive--loading">Loading archive…</div>;
  }

  const imageCount = images.length;

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
          <span className="pane__title">Map</span>
          <button
            className="pane__collapse-btn"
            onClick={toggleLeft}
            aria-label="Collapse map pane"
          >
            ◀
          </button>
        </div>
        <MapPane
          images={images}
          selectedId={selectedId}
          onSelectImage={handleSelectImage}
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
          <span className="pane__title">Collection</span>
          <button
            className="pane__collapse-btn"
            onClick={toggleRight}
            aria-label="Collapse collection pane"
          >
            ▶
          </button>
        </div>
        <CollectionPane imageCount={imageCount} />
      </div>
    </div>
  );
}
