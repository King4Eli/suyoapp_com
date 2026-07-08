import { createHmac } from "node:crypto";

/**
 * Minimal client for s3bender (https://github.com/King4Eli/s3bender).
 *
 * s3bender gives every bucket its own access key / secret key pair and signs
 * requests with the S3BENDER-HMAC-SHA256 scheme:
 *
 *   StringToSign = METHOD + "\n" + PATH + "\n" + TIMESTAMP        (header auth)
 *   StringToSign = METHOD + "\n" + PATH + "\n" + EXPIRES          (presigned URLs)
 *   Signature    = hex(lowercase) HMAC-SHA256 over the UTF-8 bytes
 *
 * PATH is the percent-decoded URL path with no query string. The body is not
 * signed. Presigned URLs are returned fully-formed by the server, so we only
 * need header auth here (to call the /presign and /acl endpoints).
 */

const CONFIG = {
  endpoint: (
    process.env.S3BENDER_ENDPOINT || "https://sss.vintolab.com"
  ).replace(/\/+$/, ""),
  publicBaseUrl: (
    process.env.S3BENDER_PUBLIC_BASE_URL ||
    process.env.S3BENDER_ENDPOINT ||
    "https://sss.vintolab.com"
  ).replace(/\/+$/, ""),
  bucket: process.env.S3BENDER_BUCKET || "nobucket",
  accessKey: process.env.S3BENDER_ACCESS_KEY || "",
  secretKey: process.env.S3BENDER_SECRET_KEY || "",
};

export function s3benderConfig() {
  return { ...CONFIG };
}

/**
 * @param {string} method
 * @param {any} path
 * @param {number} epochSeconds
 */
function signature(method, path, epochSeconds) {
  const stringToSign = `${method.toUpperCase()}\n${path}\n${epochSeconds}`;
  return createHmac("sha256", CONFIG.secretKey)
    .update(stringToSign, "utf8")
    .digest("hex");
}

function authorizationHeader(method, path) {
  const ts = Math.floor(Date.now() / 1000);
  return `S3BENDER-HMAC-SHA256 AccessKey=${CONFIG.accessKey},Timestamp=${ts},Signature=${signature(
    method,
    path,
    ts,
  )}`;
}

/** Object key -> URL path, encoding each segment but keeping the slashes. */
export function objectPathFor(key, bucket = CONFIG.bucket) {
  const encodedKey = String(key).split("/").map(encodeURIComponent).join("/");
  return `/buckets/${encodeURIComponent(bucket)}/objects/${encodedKey}`;
}

/** Absolute, world-readable URL for a public object. */
export function publicUrlFor(key, bucket = CONFIG.bucket) {
  return `${CONFIG.publicBaseUrl}${objectPathFor(key, bucket)}`;
}

/** Base URL for stored image paths (__MAPPER.img_domain). No trailing slash. */
export function publicObjectsBaseUrl(bucket = CONFIG.bucket) {
  return `${CONFIG.publicBaseUrl}/buckets/${encodeURIComponent(bucket)}/objects`;
}

async function requestPresign(key, method, expiresInSeconds) {
  const path = `/buckets/${CONFIG.bucket}/presign`;
  const res = await fetch(`${CONFIG.endpoint}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorizationHeader("POST", path),
    },
    body: JSON.stringify({ key, method, expiresInSeconds }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `s3bender presign failed: ${res.status} ${res.statusText} ${detail}`.trim(),
    );
  }

  // { url, method, expiresAt }
  return res.json();
}

/** Presigned PUT URL for uploading an object. */
export function presignPut(key, expiresInSeconds) {
  return requestPresign(key, "PUT", expiresInSeconds);
}

/** Presigned GET URL for reading a private object. */
export function presignGet(key, expiresInSeconds) {
  return requestPresign(key, "GET", expiresInSeconds);
}

/** Flip an existing object's visibility. */
export async function setObjectVisibility(key, isPublic) {
  const path = `${objectPathFor(key).replace("/objects/", "/acl/")}`;
  const res = await fetch(`${CONFIG.endpoint}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorizationHeader("PUT", decodeURIComponent(path)),
    },
    body: JSON.stringify({ public: !!isPublic }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `s3bender acl failed: ${res.status} ${res.statusText} ${detail}`.trim(),
    );
  }
  return true;
}
