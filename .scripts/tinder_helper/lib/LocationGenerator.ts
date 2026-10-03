import ngeohash from "ngeohash";
import { CountryShape } from "./CountryShape.ts";
import { Nominatim } from "./Nominatim.ts";

export type Location = Awaited<ReturnType<LocationGenerator["random"]>>;

// Random real locations inside one country, named via Nominatim reverse
// geocoding (same geocoder and geo_meta shape the API uses).
export class LocationGenerator {
  private static readonly MAX_ATTEMPTS = 10;
  private shape: Promise<CountryShape> | undefined;

  private readonly nominatim: Nominatim;
  private readonly country: string;

  constructor(nominatim: Nominatim, country: string) {
    this.nominatim = nominatim;
    this.country = country;
  }

  async random() {
    // Fetched once, on first use.
    this.shape ??= CountryShape.fetch(this.nominatim, this.country);
    const shape = await this.shape;

    for (let attempt = 0; attempt < LocationGenerator.MAX_ATTEMPTS; attempt++) {
      const point = shape.randomPoint();
      const result = await this.nominatim.reverse(point.lat, point.lng);
      // the outline is simplified, so border points can resolve to a neighbour
      if (result?.address?.country_code !== shape.code) continue;
      // Keep the sampled point itself: Nominatim's own lat/lon is the matched OSM
      // object, which in rural areas is the same county centroid for many points.
      const { lat, lng } = point;
      return {
        lat,
        lng,
        hash: ngeohash.encode(lat, lng, 12),
        meta: { ...Nominatim.placeMeta(result), latd: lat, long: lng },
      };
    }
    throw new Error(
      `no real location in ${this.country} after ${LocationGenerator.MAX_ATTEMPTS} attempts`,
    );
  }
}
