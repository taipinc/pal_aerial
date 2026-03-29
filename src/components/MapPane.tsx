import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';

interface ImageRecord {
  id: string;
  is_georeferenced: boolean;
  bounds: [number, number, number, number] | null;
  geo_webp?: string;
  [key: string]: unknown;
}

interface MapPaneProps {
  images: ImageRecord[];
  footprints: FeatureCollection;
  selectedId: string | null;
  onSelectImage: (id: string) => void;
  focusTrigger: number;
}

type BasemapKey = 'light' | 'dark' | 'satellite' | 'satellite-style';

const CARTO_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const ESRI_SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [{ id: 'satellite-layer', type: 'raster', source: 'esri-satellite' }],
};

const BASEMAPS: { key: BasemapKey; label: string; style: string | maplibregl.StyleSpecification }[] = [
  { key: 'light', label: 'Map (light)', style: CARTO_LIGHT },
  { key: 'dark', label: 'Map (dark)', style: CARTO_DARK },
  { key: 'satellite', label: 'Satellite', style: ESRI_SATELLITE_STYLE },
];

const LABEL_LAYERS = [
  'boat-label', 'airport-label', 'water-name', 'poi-label', 'road_label',
  'place-label', 'country-label', 'region-label', 'city-label', 'settlement-label',
  'airport-label крупный', 'road_label-large', 'road_label-medium', 'road_label-small',
  'place_label', 'water_label', 'landuse_label', 'mountain_peak_label'
];

const FOOTPRINTS_SOURCE = 'footprints';
const FOOTPRINTS_FILL = 'footprints-fill';
const FOOTPRINTS_LINE = 'footprints-line';
const OVERLAY_SOURCE = 'selected-overlay';
const OVERLAY_LAYER = 'selected-overlay-layer';
const DEFAULT_OPACITY = 1.0;

export default function MapPane({ images, footprints, selectedId, onSelectImage, focusTrigger }: MapPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedOverlayRef = useRef<string | null>(null);

  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<BasemapKey>('light');
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [footprintsVisible, setFootprintsVisible] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSelectRef = useRef(onSelectImage);
  onSelectRef.current = onSelectImage;

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Add footprint layers to map
  const addFootprintLayers = useCallback((map: maplibregl.Map) => {
    // Clean up any existing sources/layers first
    if (map.getLayer(FOOTPRINTS_FILL)) map.removeLayer(FOOTPRINTS_FILL);
    if (map.getLayer(FOOTPRINTS_LINE)) map.removeLayer(FOOTPRINTS_LINE);
    if (map.getSource(FOOTPRINTS_SOURCE)) map.removeSource(FOOTPRINTS_SOURCE);

    // Read color from CSS custom property
    const footprintColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--footprint-color').trim() || '#c8a97e';

    map.addSource(FOOTPRINTS_SOURCE, {
      type: 'geojson',
      data: footprints,
      generateId: true,
    });

    const sel = selectedIdRef.current ?? '';

    // Invisible fill — keeps the polygon clickable
    map.addLayer({
      id: FOOTPRINTS_FILL,
      type: 'fill',
      source: FOOTPRINTS_SOURCE,
      filter: sel ? ['!=', ['get', 'id'], sel] : ['literal', true],
      paint: {
        'fill-color': footprintColor,
        'fill-opacity': 0,
      },
    });

    map.addLayer({
      id: FOOTPRINTS_LINE,
      type: 'line',
      source: FOOTPRINTS_SOURCE,
      filter: sel ? ['!=', ['get', 'id'], sel] : ['literal', true],
      paint: {
        'line-color': footprintColor,
        'line-width': 1.5,
        'line-opacity': 0.7,
      },
    });

    // Move to top
    map.moveLayer(FOOTPRINTS_FILL);
    map.moveLayer(FOOTPRINTS_LINE);

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (feature?.properties?.id) {
        onSelectRef.current(feature.properties.id);
      }
    };

    map.on('click', FOOTPRINTS_FILL, handleClick);
    map.on('click', FOOTPRINTS_LINE, handleClick);
    map.on('mouseenter', FOOTPRINTS_FILL, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', FOOTPRINTS_FILL, () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', FOOTPRINTS_LINE, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', FOOTPRINTS_LINE, () => { map.getCanvas().style.cursor = ''; });
  }, [footprints]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const baseStyle = BASEMAPS.find((b) => b.key === basemap)!.style;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle,
      center: [35.0, 32.0],
      zoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    mapRef.current = map;

    map.on('load', () => {
      addFootprintLayers(map);
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedOverlayRef.current = null;
      setMapReady(false);
    };
  }, [images]);

  // Switch basemap style
  const switchBasemap = useCallback((key: BasemapKey) => {
    const map = mapRef.current;
    if (!map || key === basemap) return;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();

    setBasemap(key);
    setMapReady(false);
    loadedOverlayRef.current = null;

    const baseStyle = BASEMAPS.find((b) => b.key === key)!.style;
    map.setStyle(baseStyle);

    // Both styledata and style.load may fire - handle whichever comes first
    const handleStyleData = () => {
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      map.setPitch(pitch);
      addFootprintLayers(map);
      setMapReady(true);
      console.log('[MAP] styledata, basemap:', key);
    };

    map.once('styledata', handleStyleData);
    map.once('style.load', handleStyleData);
    
    // Fallback: if no event fires within 2 seconds, add layers anyway
    setTimeout(() => {
      if (!mapReady) {
        console.log('[MAP] fallback triggered, basemap:', key);
        addFootprintLayers(map);
        setMapReady(true);
      }
    }, 2000);
  }, [basemap, addFootprintLayers]);

  // Update footprint filter when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const sel = selectedId ?? '';
    const filter = sel ? ['!=', ['get', 'id'], sel] : ['literal', true];

    if (map.getLayer(FOOTPRINTS_FILL)) map.setFilter(FOOTPRINTS_FILL, filter as maplibregl.FilterSpecification);
    if (map.getLayer(FOOTPRINTS_LINE)) map.setFilter(FOOTPRINTS_LINE, filter as maplibregl.FilterSpecification);
  }, [selectedId, mapReady]);

  // Toggle footprint visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const vis = footprintsVisible ? 'visible' : 'none';
    if (map.getLayer(FOOTPRINTS_FILL)) map.setLayoutProperty(FOOTPRINTS_FILL, 'visibility', vis);
    if (map.getLayer(FOOTPRINTS_LINE)) map.setLayoutProperty(FOOTPRINTS_LINE, 'visibility', vis);
  }, [footprintsVisible, mapReady]);

  // Toggle labels visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!labelsVisible) {
      map.getStyle().layers.forEach(layer => {
        if (LABEL_LAYERS.some(id => layer.id.includes(id)) || 
            layer.type === 'symbol' || 
            (layer.id.includes('label') && !layer.id.includes('ground'))) {
          try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch {}
        }
      });
    } else {
      map.getStyle().layers.forEach(layer => {
        try { map.setLayoutProperty(layer.id, 'visibility', 'visible'); } catch {}
      });
    }
  }, [labelsVisible, mapReady]);

  // Manage the single selected image overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove previous overlay
    if (loadedOverlayRef.current) {
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
      coordinates: [[W, N], [E, N], [E, S], [W, S]],
    });

    // Toast if image fails to load as map overlay
    map.once('error', () => {
      showToast('Image could not be loaded on map');
    });

    // Add overlay below footprints so footprints stay on top
    map.addLayer(
      {
        id: OVERLAY_LAYER,
        type: 'raster',
        source: OVERLAY_SOURCE,
        paint: { 'raster-opacity': opacity },
      },
      FOOTPRINTS_FILL,
    );

    // Force overlay below footprints after adding
    requestAnimationFrame(() => {
      map.moveLayer(OVERLAY_LAYER, FOOTPRINTS_FILL);
    });

    loadedOverlayRef.current = selectedId;

    map.fitBounds([[W, S], [E, N]], { padding: 60, duration: 1200 });
  }, [selectedId, mapReady, images]);

  // Re-fly when focusTrigger fires
  useEffect(() => {
    if (!focusTrigger) return;
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) return;
    const img = images.find((i) => i.id === selectedId);
    if (!img?.bounds) return;
    const [W, S, E, N] = img.bounds;
    map.fitBounds([[W, S], [E, N]], { padding: 60, duration: 1200 });
  }, [focusTrigger, mapReady]);

  // Update overlay opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !loadedOverlayRef.current) return;
    if (map.getLayer(OVERLAY_LAYER)) {
      map.setPaintProperty(OVERLAY_LAYER, 'raster-opacity', opacity);
    }
  }, [opacity, mapReady]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setOpacity(parseFloat(e.target.value)),
    [],
  );

  const toggleOpacity = useCallback(() => {
    setOpacity((prev) => (prev > 0 ? 0 : 1));
  }, []);

  const hasOverlay = selectedId != null &&
    images.some((i) => i.id === selectedId && i.is_georeferenced && i.bounds && i.geo_webp);

  return (
    <div className="map-pane">
      <div ref={containerRef} className="map-pane__container" />
      <div className="map-pane__controls">
        <button
          className={`map-pane__toggle-btn${!footprintsVisible ? ' map-pane__toggle-btn--active' : ''}`}
          onClick={() => setFootprintsVisible((v) => !v)}
        >
          {footprintsVisible ? 'Footprints: on' : 'Footprints: off'}
        </button>
        {hasOverlay && (
          <>
            <button className="map-pane__toggle-btn" onClick={toggleOpacity}>
              {opacity > 0 ? 'Hide' : 'Show'}
            </button>
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
          </>
        )}
      </div>
      <div className="map-pane__basemap-switcher">
        {BASEMAPS.map((b) => (
          <button
            key={b.key}
            className={`map-pane__basemap-btn${basemap === b.key ? ' map-pane__basemap-btn--active' : ''}`}
            onClick={() => switchBasemap(b.key)}
          >
            {b.label}
          </button>
        ))}
        <button
          className={`map-pane__basemap-btn${!labelsVisible ? ' map-pane__basemap-btn--active' : ''}`}
          onClick={() => setLabelsVisible((v) => !v)}
        >
          Labels: {labelsVisible ? 'on' : 'off'}
        </button>
      </div>
      {toast && <div key={toast} className="map-toast">{toast}</div>}
    </div>
  );
}
