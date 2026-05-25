import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RoutePoint } from '../../types';
import { getMapStyle, ROUTE_COLORS, ROUTE_LINE_PAINT } from '../../config/mapStyles';

maplibregl.setWorkerUrl(maplibreWorker);

const ROUTE_SOURCE = 'route';
const START_SOURCE = 'start';
const END_SOURCE = 'end';

const EMPTY_LINE: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: [] },
};

const EMPTY_POINTS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

interface RunRouteMapProps {
  points: RoutePoint[];
  className?: string;
  followLatest?: boolean;
  /** When false, map is display-only (feed thumbnails) */
  interactive?: boolean;
}

function toLineGeoJSON(points: RoutePoint[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.lng, p.lat]),
    },
  };
}

function toPointGeoJSON(point: RoutePoint): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates: [point.lng, point.lat],
    },
  };
}

function setupRouteLayers(map: maplibregl.Map) {
  if (map.getSource(ROUTE_SOURCE)) return;

  map.addSource(ROUTE_SOURCE, { type: 'geojson', data: EMPTY_LINE });
  map.addSource(START_SOURCE, { type: 'geojson', data: EMPTY_POINTS });
  map.addSource(END_SOURCE, { type: 'geojson', data: EMPTY_POINTS });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: ROUTE_LINE_PAINT,
  });

  map.addLayer({
    id: 'start-marker',
    type: 'circle',
    source: START_SOURCE,
    paint: {
      'circle-radius': 6,
      'circle-color': ROUTE_COLORS.start,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.addLayer({
    id: 'end-marker',
    type: 'circle',
    source: END_SOURCE,
    paint: {
      'circle-radius': 6,
      'circle-color': ROUTE_COLORS.end,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
}

function updateRouteData(map: maplibregl.Map, points: RoutePoint[]) {
  const routeSource = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
  const startSource = map.getSource(START_SOURCE) as maplibregl.GeoJSONSource | undefined;
  const endSource = map.getSource(END_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!routeSource || !startSource || !endSource) return;

  routeSource.setData(points.length >= 2 ? toLineGeoJSON(points) : EMPTY_LINE);
  startSource.setData(
    points.length > 0
      ? { type: 'FeatureCollection', features: [toPointGeoJSON(points[0])] }
      : EMPTY_POINTS,
  );
  endSource.setData(
    points.length > 1
      ? { type: 'FeatureCollection', features: [toPointGeoJSON(points[points.length - 1])] }
      : EMPTY_POINTS,
  );
}

function fitRoute(map: maplibregl.Map, points: RoutePoint[], followLatest: boolean) {
  if (points.length === 0) return;

  const last = points[points.length - 1];

  if (followLatest) {
    map.easeTo({ center: [last.lng, last.lat], zoom: 16, duration: 500 });
    return;
  }

  if (points.length === 1) {
    map.easeTo({ center: [last.lng, last.lat], zoom: 16, duration: 0 });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const p of points) {
    bounds.extend([p.lng, p.lat]);
  }
  map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 16 });
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function RunRouteMap({ points, className = '', followLatest = false, interactive = true }: RunRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pointsRef = useRef(points);
  const followLatestRef = useRef(followLatest);
  const isDarkRef = useRef(isDarkMode());

  pointsRef.current = points;
  followLatestRef.current = followLatest;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(isDarkRef.current),
      center: [-98, 39],
      zoom: 4,
      attributionControl: interactive ? { compact: true } : false,
      interactive,
    });

    mapRef.current = map;

    const onStyleReady = () => {
      setupRouteLayers(map);
      updateRouteData(map, pointsRef.current);
      fitRoute(map, pointsRef.current, followLatestRef.current);
    };

    map.on('load', onStyleReady);
    map.on('style.load', onStyleReady);

    const observer = new MutationObserver(() => {
      const dark = isDarkMode();
      if (dark === isDarkRef.current) return;
      isDarkRef.current = dark;
      map.setStyle(getMapStyle(dark));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    updateRouteData(map, points);
    fitRoute(map, points, followLatest);
  }, [points, followLatest]);

  const showWaitingOverlay = followLatest && points.length === 0;
  const showNoRouteOverlay = !followLatest && points.length === 0;

  return (
    <div className={['relative h-56 w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800', className].join(' ')}>
      <div ref={containerRef} className="absolute inset-0" />
      {showWaitingOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 pointer-events-none">
          <span className="text-xs text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-gray-900/80 px-3 py-1.5 rounded-full">
            Waiting for GPS…
          </span>
        </div>
      )}
      {showNoRouteOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-gray-400">Route data not available.</span>
        </div>
      )}
    </div>
  );
}
