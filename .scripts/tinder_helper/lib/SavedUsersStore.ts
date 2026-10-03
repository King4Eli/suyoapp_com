import { readFile, writeFile } from "node:fs/promises";

// Ids already scraped, kept in a JSON file across runs.
export class SavedUsersStore {
  private ids = new Set<string>();

  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  get size() {
    return this.ids.size;
  }

  has(id: string) {
    return this.ids.has(id);
  }

  add(id: string) {
    this.ids.add(id);
  }

  async load() {
    try {
      const arr = JSON.parse(await readFile(this.path, "utf8"));
      this.ids = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      this.ids = new Set();
    }
  }

  async save() {
    await writeFile(this.path, JSON.stringify([...this.ids], null, 2), "utf8");
  }
}
