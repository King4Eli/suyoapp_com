import { defineConfig } from "drizzle-kit";

// Code-first: db/schema.js is the hand-edited source of truth. Change it,
// then run `npm run migrate:create` (drizzle-kit generate) to diff it
// against db/migrations/ and write a new SQL migration file, then
// `npm run migrate:apply` to run it. See db/README.md.
export default defineConfig({
  dialect: "mysql",
  schema: "./db/schema.js",
  out: "./db/migrations",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "mydb",
  },
});
