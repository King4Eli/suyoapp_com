import { readFile } from "node:fs/promises";

export class TinderClient {
  // Host/Accept-Encoding are managed by fetch itself.
  private static readonly SKIPPED_HEADERS = new Set(["host", "accept-encoding"]);

  private readonly recsPath: string;
  private readonly headers: Record<string, string>;

  private constructor(recsPath: string, headers: Record<string, string>) {
    this.recsPath = recsPath;
    this.headers = headers;
  }

  static async fromHttpPayload(path: string): Promise<TinderClient> {
    const [requestLine = "", ...headerLines] = (await readFile(path, "utf8"))
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter(Boolean);

    const headers: Record<string, string> = {};
    for (const line of headerLines) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const name = line.slice(0, idx).trim();
      if (TinderClient.SKIPPED_HEADERS.has(name.toLowerCase())) continue;
      headers[name] = line.slice(idx + 1).trim();
    }
    if (!headers["X-Auth-Token"] || !headers["Persistent-Device-Id"]) {
      throw new Error(`Missing X-Auth-Token or Persistent-Device-Id in ${path}`);
    }

    const recsPath = requestLine.split(" ")[1] ?? "/v2/recs/core?locale=en&duos=0";
    return new TinderClient(recsPath, headers);
  }

  async fetchRecs(): Promise<any[]> {
    const res = await fetch(`https://api.gotinder.com${this.recsPath}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Tinder HTTP ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    return (json?.data?.results ?? [])
      .filter((r: any) => r.type === "user" && r.user)
      .map((r: any) => r.user);
  }
}
