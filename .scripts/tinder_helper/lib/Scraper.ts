import type { CircuitBreaker } from "./CircuitBreaker.ts";
import type { PhotoUploader } from "./PhotoUploader.ts";
import type { SavedUsersStore } from "./SavedUsersStore.ts";
import type { TinderClient } from "./TinderClient.ts";
import { UserMapper } from "./UserMapper.ts";
import type { UserRepository } from "./UserRepository.ts";

// Pulls Tinder recs, uploads each new user's photos, then saves them.
export class Scraper {
  private processed = 0;
  private skipped = 0;
  private aborted = false;

  private readonly tinder: TinderClient;
  private readonly photos: PhotoUploader;
  private readonly uploadBreaker: CircuitBreaker;
  private readonly mapper: UserMapper;
  private readonly repo: UserRepository;
  private readonly saved: SavedUsersStore;
  private readonly opts: { pulls: number; dryRun: boolean };

  constructor(
    tinder: TinderClient,
    photos: PhotoUploader,
    uploadBreaker: CircuitBreaker,
    mapper: UserMapper,
    repo: UserRepository,
    saved: SavedUsersStore,
    opts: { pulls: number; dryRun: boolean },
  ) {
    this.tinder = tinder;
    this.photos = photos;
    this.uploadBreaker = uploadBreaker;
    this.mapper = mapper;
    this.repo = repo;
    this.saved = saved;
    this.opts = opts;
  }

  /** Returns true when the scrape was aborted by the upload circuit breaker. */
  async run(): Promise<boolean> {
    await this.saved.load();
    console.log(`loaded ${this.saved.size} previously-saved user ids`);

    for (let run = 1; run <= this.opts.pulls && !this.aborted; run++) {
      console.log(`\n▶ Pull ${run}/${this.opts.pulls}`);
      let recs: any[];
      try {
        recs = await this.tinder.fetchRecs();
      } catch (e) {
        console.error(`  fetch failed: ${(e as Error).message}`);
        continue;
      }
      console.log(`  fetched ${recs.length} users`);

      for (const u of recs) {
        if (this.aborted) break;
        await this.processUser(u);
      }

      // Persist progress after each page so a crash doesn't lose work.
      if (!this.opts.dryRun) await this.saved.save();
    }

    if (!this.opts.dryRun) await this.saved.save();

    console.log(
      `\nDone. processed=${this.processed} skipped=${this.skipped} ` +
        `total_saved=${this.saved.size} aborted=${this.aborted}`,
    );
    return this.aborted;
  }

  private async processUser(u: any) {
    if (this.saved.has(u._id)) {
      console.log(`  ↷ ${u.name} (already saved)`);
      this.skipped++;
      return;
    }

    if (this.opts.dryRun) {
      console.dir({ user: await this.mapper.toUserRow(u) }, { depth: null });
      return;
    }

    let uploadedPhotoPaths: string[];
    try {
      uploadedPhotoPaths = await this.photos.uploadUserPhotos(u);
      this.uploadBreaker.recordSuccess();
    } catch (e) {
      this.uploadBreaker.recordFailure();
      console.error(
        `  ✗ photo upload failed for ${u.name}; user skipped: ${(e as Error).message}`,
      );
      console.error(
        `    upload failures: ${this.uploadBreaker.failures}/${this.uploadBreaker.limit}`,
      );
      this.skipped++;

      if (this.uploadBreaker.tripped) {
        this.aborted = true;
        console.error(
          `\n✖ Aborting: ${this.uploadBreaker.limit} consecutive photo-upload failures`,
        );
      }
      return;
    }

    try {
      const row = await this.mapper.toUserRow(u, uploadedPhotoPaths);
      await this.repo.upsertUser(row);
      await this.repo.addInterests(row.userId, UserMapper.interests(u));
      await this.repo.upsertPrompts(row.userId, UserMapper.prompts(u));
      this.saved.add(u._id);
      this.processed++;
      console.log(`  ✓ ${u.name} (${u._id})`);
    } catch (e) {
      console.error(`  ✗ save failed for ${u.name}: ${(e as Error).message}`);
    }
  }
}
