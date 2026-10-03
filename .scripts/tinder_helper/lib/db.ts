import { loadEnvFile } from "node:process";
import { CONFIG } from "./config.ts";

// Load the API database settings before importing the DB client.
loadEnvFile(CONFIG.dbEnvPath);
export const { db } = await import("../../../api/db/client.js");
