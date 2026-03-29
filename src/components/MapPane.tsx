import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface ImageRecord {
  id: string;
  is_georeferenced: boolean;
  bounds: [number, number, number, number] | null;
  geo_webp?: string;
  [key: string]: unknown;
}

interface MapPaneProps {
  images: ImageRecord[];
  selectedId: string | null;
  onSelectImage: (id: string) => void;
  focusTrigger: number;
}

const STYLE_URL = 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json';
const DOTS_SOURCE = 'georef-dots';
const DOTS_LAYER = 'georef-dots-layer';
const OVERLAY_SOURCE = 'selected-overlay';
const OVERLAY_LAYER = 'selected-overlay-layer';
const DEFAULT_OPACITY = 0.85;

export default function MapPane({ images, selectedId, onSelectImage, focusTrigger }: MapPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedOverlayRef = useRef<string | null>(null);

  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [mapReady, setMapReady] = useState(false);

  const onSelectRef = useRef(onSelectImage);
  onSelectRef.current = onSelectImage;

  // Build GeoJSON for dot markers — stable across renders since images loads once
  const dotsGeoJson = useRef<GeoJSON.FeatureCollection | null>(null);
  if (!dotsGeoJson.current) {
    const features: GeoJSON.Feature[] = [];
    for (const img of images) {
      if (!img.is_georeferenced || !img.bounds || !img.geo_webp) continue;
      const [W, S, E, N] = img.bounds;
      features.push({
        type: 'Feature',
        properties: { id: img.id },
        geometry: {
          type: 'Point',
          coordinates: [(W + E) / 2, (S + N) / 2],
        },
      });
    }
    dotsGeoJson.current = { type: 'FeatureCollection', features };
  }

  // Initialize map — runs once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [35.0, 32.0],
      zoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      // Single GeoJSON source + circle layer for all georeferenced dots
      map.addSource(DOTS_SOURCE, {
        type: 'geojson',
        data: dotsGeoJson.current!,
      });

      map.addLayer({
        id: DOTS_LAYER,
        type: 'circle',
        source: DOTS_SOURCE,
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            7,
            4,
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'id'], selectedId ?? ''],
            '#c8a97e',
            '#7a9cbf',
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
        },
      });

      // Click handler for dots
      map.on('click', DOTS_LAYER, (e) => {
        const feature = e.features?.[0];
        if (feature?.properties?.id) {
          onSelectRef.current(feature.properties.id);
        }
      });

      map.on('mouseenter', DOTS_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', DOTS_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedOverlayRef.current = null;
      setMapReady(false);
    };
  }, [images]);

  // Update dot styles when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const sel = selectedId ?? '';
    map.setPaintProperty(DOTS_LAYER, 'circle-radius', [
      'case', ['==', ['get', 'id'], sel], 7, 4,
    ]);
    map.setPaintProperty(DOTS_LAYER, 'circle-color', [
      'case', ['==', ['get', 'id'], sel], '#c8a97e', '#7a9cbf',
    ]);
  }, [selectedId, mapReady]);

  // Manage the single selected image overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const prev = loadedOverlayRef.current;

    // Remove previous overlay if any
    if (prev) {
      if (map.getLayer(OVERLAY_LAYER)) map.removeLayer(OVERLAY_LAYER);
      if (map.getSource(OVERLAY_SOURCE)) map.removeSource(OVERLAY_SOURCE);
      loadedOverlayRef.current = null;
    }

    if (!selectedId) return;

    const img = images.find((i) => i.id === selectedId);
    if (!img?.is_georeferenced || !img.bounds || !img.geo_webp) return;

    const [W, S, E, N] = img.bounds;

    map.addSource(OVERLAY_SOURCE, {
      type: 'image',
      url: img.geo_webp,
      coordinates: [
        [W, N], // top-left
        [E, N], // top-right
        [E, S], // bottom-right
        [W, S], // bottom-left
      ],
    });

    map.addLayer({
      id: OVERLAY_LAYER,
      type: 'raster',
      source: OVERLAY_SOURCE,
      paint: { 'raster-opacity': opacity },
    });

    loadedOverlayRef.current = selectedId;

    // Fly to the image bounds
    map.fitBounds([[W, S], [E, N]], {
      padding: 60,
      duration: 1200,
    });
  }, [selectedId, mapReady, images]);

  // Re-fly to selected image when focusTrigger fires
  useEffect(() => {
    if (!focusTrigger) return;
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) return;
    const img = images.find((i) => i.id === selectedId);
    if (!img?.bounds) return;
    const [W, S, E, N] = img.bounds;
    map.fitBounds([[W, S], [E, N]], { padding: 60, duration: 1200 });
  }, [focusTrigger, mapReady]);

  // Update overlay opacity when slider changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !loadedOverlayRef.current) return;
    if (map.getLayer(OVERLAY_LAYER)) {
      map.setPaintProperty(OVERLAY_LAYER, 'raster-opacity', opacity);
    }
  }, [opacity, mapReady]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOpacity(parseFloat(e.target.value));
    },
    []
  );

  const hasOverlay = selectedId != null &&
    images.some((i) => i.id === selectedId && i.is_georeferenced && i.bounds && i.geo_webp);

  return (
    <div className="map-pane">
      <div ref={containerRef} className="map-pane__container" />
      {hasOverlay && (
        <div className="map-pane__controls">
          <label className="map-pane__label">Opacity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={handleOpacityChange}
            className="map-pane__slider"
            title={`Opacity: ${Math.round(opacity * 100)}%`}
          />
        </div>
      )}
    </div>
  );
}
