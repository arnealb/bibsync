/** A single point on a plotted walking route (WGS84). */
export interface RoutePoint {
  lat: number;
  lng: number;
}

/** Parses unknown jsonb into a clean RoutePoint array (defensive). */
export function toRoutePoints(value: unknown): RoutePoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (p): p is RoutePoint =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as RoutePoint).lat === "number" &&
        typeof (p as RoutePoint).lng === "number",
    )
    .map((p) => ({ lat: p.lat, lng: p.lng }));
}
