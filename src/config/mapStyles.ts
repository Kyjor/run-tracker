const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function getMapStyle(isDark: boolean): string {
  return isDark ? DARK_STYLE : LIGHT_STYLE;
}

export const ROUTE_COLORS = {
  line: '#22c55e',
  start: '#22c55e',
  end: '#0ea5e9',
} as const;

export const ROUTE_LINE_PAINT = {
  'line-color': ROUTE_COLORS.line,
  'line-width': 3,
  'line-opacity': 0.9,
} as const;
