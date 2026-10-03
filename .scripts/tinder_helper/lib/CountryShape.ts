import type { Nominatim } from "./Nominatim.ts";

type Ring = [number, number][]; // [lng, lat] pairs, GeoJSON order
type Polygon = {
  rings: Ring[]; // outer ring first, then holes
  bbox: [number, number, number, number];
  area: number; // bbox area, for weighted picking
};

// A country's (simplified) outline, for sampling random points inside it.
export class CountryShape {
  private readonly totalArea: number;

  readonly code: string;
  private readonly polygons: Polygon[];

  private constructor(code: string, polygons: Polygon[]) {
    this.code = code;
    this.polygons = polygons;
    this.totalArea = polygons.reduce((sum, p) => sum + p.area, 0);
  }

  static async fetch(nominatim: Nominatim, country: string): Promise<CountryShape> {
    const result = await nominatim.searchCountry(country);
    const geojson = result?.geojson;
    const code = result?.address?.country_code;
    if (!code || !geojson) throw new Error(`Nominatim has no outline for "${country}"`);

    const raw: Ring[][] =
      geojson.type === "Polygon" ? [geojson.coordinates]
      : geojson.type === "MultiPolygon" ? geojson.coordinates
      : [];
    const polygons = raw.map((rings) => {
      const lngs = rings[0].map(([lng]) => lng);
      const lats = rings[0].map(([, lat]) => lat);
      const bbox: [number, number, number, number] = [
        Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats),
      ];
      return { rings, bbox, area: (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) };
    });

    const shape = new CountryShape(code, polygons);
    if (!shape.totalArea) throw new Error(`Empty outline for "${country}"`);
    return shape;
  }

  // Uniform-ish point inside the country: pick a polygon by bbox area, then
  // rejection-sample its bbox until the point lands inside it (and not in a hole).
  randomPoint(): { lat: number; lng: number } {
    for (;;) {
      let roll = Math.random() * this.totalArea;
      const polygon =
        this.polygons.find((p) => (roll -= p.area) <= 0) ?? this.polygons[0];
      const [minLng, minLat, maxLng, maxLat] = polygon.bbox;
      const lng = minLng + Math.random() * (maxLng - minLng);
      const lat = minLat + Math.random() * (maxLat - minLat);
      const [outer, ...holes] = polygon.rings;
      if (
        CountryShape.inRing(lng, lat, outer) &&
        !holes.some((h) => CountryShape.inRing(lng, lat, h))
      ) {
        return { lat, lng };
      }
    }
  }

  // Ray casting; [lng, lat] like the rings.
  private static inRing(lng: number, lat: number, ring: Ring): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
}
