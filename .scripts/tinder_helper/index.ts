import { CircuitBreaker } from "./lib/CircuitBreaker.ts";
import { CONFIG } from "./lib/config.ts";
import { LocationGenerator } from "./lib/LocationGenerator.ts";
import { Nominatim } from "./lib/Nominatim.ts";
import { PhotoUploader } from "./lib/PhotoUploader.ts";
import { SavedUsersStore } from "./lib/SavedUsersStore.ts";
import { Scraper } from "./lib/Scraper.ts";
import { SuyoApi } from "./lib/SuyoApi.ts";
import { TinderClient } from "./lib/TinderClient.ts";
import { UserMapper } from "./lib/UserMapper.ts";
import { UserRepository } from "./lib/UserRepository.ts";

async function main() {
  const scraper = new Scraper(
    await TinderClient.fromHttpPayload(CONFIG.httpPayloadPath),
    new PhotoUploader(new SuyoApi(CONFIG.apiDomain), CONFIG.minUserPhotos, CONFIG.maxUserPhotos),
    new CircuitBreaker(CONFIG.maxUploadFailures),
    new UserMapper(new LocationGenerator(new Nominatim(), CONFIG.populateCountryLocation)),
    new UserRepository(),
    new SavedUsersStore(CONFIG.savedUsersPath),
    { pulls: CONFIG.loopIterationPull, dryRun: CONFIG.dryRun },
  );

  const aborted = await scraper.run();
  process.exit(aborted ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
