// Which build of the API is running: the git commit sha CI bakes into the image
// (Dockerfile ARG BUILD_HASH -> ENV), "dev" for local builds. Stamped on every
// log row (logs_application.build_hash) so an error can be traced to the exact
// deployed code.
export const BUILD_HASH = (process.env.BUILD_HASH || "dev").trim().slice(0, 64);

/** Short form for humans (first 7 chars of a sha). */
export const BUILD_SHORT = /^[0-9a-f]{40}$/i.test(BUILD_HASH)
  ? BUILD_HASH.slice(0, 7)
  : BUILD_HASH;
