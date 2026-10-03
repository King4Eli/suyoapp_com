import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SCRIPT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export const CONFIG = {
  // Raw request copied from browser devtools: request line, then "Name: value" headers.
  httpPayloadPath: join(SCRIPT_DIR, ".http_payload.txt"),
  dbEnvPath: join(SCRIPT_DIR, "../../.env/db.env"),
  savedUsersPath: ".saveduser.json",
  dryRun: process.argv.slice(2).includes("--dry-run"),
  loopIterationPull: 15,
  minUserPhotos: 2,
  maxUserPhotos: 5,
  maxUploadFailures: 3,
  apiDomain: (process.env.SUYO_API_DOMAIN ?? "https://api.suyoapp.com").replace(/\/+$/, ""),
  populateCountryLocation: [
    "USA","Canada","Mexico","Brazil","Argentina","Colombia","Chile","Peru","Venezuela","Ecuador","Guatemala","Cuba","Bolivia","Honduras","Paraguay","El Salvador","Nicaragua","Costa Rica","Panama","Uruguay","Jamaica","Trinidad and Tobago","Guyana","Suriname"
  ][0],
};
