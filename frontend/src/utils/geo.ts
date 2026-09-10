/**
 * Format geographic latitude and longitude with correct hemisphere indicators.
 * Examples:
 *   formatCoordinate(25.7704, -80.1514) => "25.7704° N, 80.1514° W"
 *   formatCoordinate(25.7704, 80.1514)  => "25.7704° N, 80.1514° E"
 *   formatCoordinate(-25.7704, -80.1514) => "25.7704° S, 80.1514° W"
 *   formatCoordinate(-25.7704, 80.1514)  => "25.7704° S, 80.1514° E"
 */
export function formatCoordinate(
  lat: number | null | undefined,
  lon: number | null | undefined,
  precision = 4
): string {
  if (
    lat === null ||
    lat === undefined ||
    isNaN(lat) ||
    lon === null ||
    lon === undefined ||
    isNaN(lon)
  ) {
    return 'COORDINATES UNAVAILABLE';
  }

  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';

  const latVal = Math.abs(lat).toFixed(precision);
  const lonVal = Math.abs(lon).toFixed(precision);

  return `${latVal}° ${latDir}, ${lonVal}° ${lonDir}`;
}

export function formatLatitude(lat: number | null | undefined, precision = 4): string {
  if (lat === null || lat === undefined || isNaN(lat)) return 'N/A';
  const dir = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(precision)}° ${dir}`;
}

export function formatLongitude(lon: number | null | undefined, precision = 4): string {
  if (lon === null || lon === undefined || isNaN(lon)) return 'N/A';
  const dir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(precision)}° ${dir}`;
}
