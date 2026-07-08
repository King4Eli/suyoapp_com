import { randomBytes } from "crypto";
import { tools, envInt } from "../../global/functions.js";
import { sessions } from "../../global/sessions.js";
import {
  s3benderConfig,
  presignPut,
  publicUrlFor,
} from "../../global/s3bender.js";

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "mp4",
  "mov",
  "avi",
  "wmv",
  "flv",
  "webm",
  "mkv",
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "flac",
  //"pdf", "txt"
]);

const Allowed_Bucket_Types = {
  "profile-media": (userId = "00-00") => `users/${userId}/profile_media`,
  "profile-verify": (userId = "00-00") => `users/${userId}/verify`,
  "convo-img": (convoId = "00-00") => `conversations/${convoId}/chat_img`,
  "convo-audio": (convoId = "00-00") => `conversations/${convoId}/chat_audio`,
  "convo-video": (convoId = "00-00") => `conversations/${convoId}/chat_video`,
  "feed-media": (userId = "00-00") => `users/${userId}/feed_media`,
  "signup-void": () => "signup_void",
};

// Upload types whose objects are world-readable — served as plain URLs with no
// signing, the same behaviour the old MinIO "anonymous download" policy gave.
// Remove a type from this set to make its uploads private (signed/presigned
// reads only); handleFileUpload will then stop returning a publicUrl and stop
// tagging the upload with X-S3Bender-Public.
const PUBLIC_BUCKET_TYPES = new Set([
  "profile-media",
  "profile-verify",
  "convo-img",
  "convo-audio",
  "convo-video",
  "feed-media",
  "signup-void",
]);

const MAX_SIZES = {
  img: 10 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

function normalizeExtension(inputExtension = null) {
  const normalized = String(inputExtension || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "")
    .replace(/[^a-z0-9]/g, "");

  return ALLOWED_EXTENSIONS.has(normalized) ? normalized : null;
}

function getMediaType(ext = "") {
  if (/^(jpg|jpeg|png|gif|webp|bmp)$/.test(ext)) return "img";
  if (/^(mp4|mov|avi|wmv|flv|webm|mkv)$/.test(ext)) return "video";
  if (/^(mp3|wav|m4a|aac|ogg|flac)$/.test(ext)) return "audio";
  return "document";
}

export default async function handleFileUpload(
  fileData = {
    extension: null,
    bucketType: null,
    convoId: null,
    fileSize: null,
  },
) {
  const response = {
    code: 500,
    message: "Unable to generate upload URL.5",
  };

  try {
    const fileExt = normalizeExtension(fileData?.extension);
    const convoId = fileData?.convoId;
    const bucketType = fileData?.bucketType;
    const fileSize = fileData?.fileSize;

    // Validate inputs
    if (!fileExt) {
      return {
        code: 400,
        message: "File type not allowed or invalid extension.",
      };
    }

    if (!bucketType || !Allowed_Bucket_Types[bucketType]) {
      return { code: 400, message: "Invalid bucket type specified." };
    }

    const isSignupUpload = bucketType === "signup-void";

    // Check if user is authenticated. Signup uploads happen before a session exists,
    // but are restricted to the signup_void path.
    if (!isSignupUpload && !sessions?.currentUserID) {
      return { code: 401, message: "User not authenticated." };
    }

    // Check if conversation ID is required
    // @ts-ignore
    if (bucketType?.startsWith("convo") && !convoId) {
      return {
        code: 400,
        message: "Conversation ID required for conversation uploads.",
      };
    }

    // Validate file size
    if (fileSize) {
      const mediaType = getMediaType(fileExt);
      if (fileSize > MAX_SIZES[mediaType]) {
        return {
          code: 400,
          message: `File too large. Maximum size for ${mediaType} is ${MAX_SIZES[mediaType] / 1024 / 1024}MB.`,
        };
      }
    }

    const cfg = s3benderConfig();
    const bucket = cfg.bucket;

    // Generate unique file key
    const timestamp = Date.now();
    const uniqueId = randomBytes(8).toString("hex");

    // Build path based on bucket type
    let basePath;
    // @ts-ignore
    if (bucketType?.startsWith("convo")) {
      // @ts-ignore
      basePath = Allowed_Bucket_Types[bucketType](convoId);
    } else if (isSignupUpload) {
      // @ts-ignore
      basePath = Allowed_Bucket_Types[bucketType]();
    } else {
      // @ts-ignore
      basePath = Allowed_Bucket_Types[bucketType](sessions?.currentUserID);
    }

    const fileKey = `${basePath}/${timestamp}-${uniqueId}.${fileExt}`;
    const expiresInSeconds = envInt("UPLOAD_PRESIGNED_URL_TTL_SECONDS", 60 * 5); // 5 minutes
    const isPublic = PUBLIC_BUCKET_TYPES.has(bucketType);

    // s3bender buckets are provisioned once (out of band / via the admin Storage
    // page); there's no create-on-write like MinIO's makeBucket.
    const presigned = await presignPut(fileKey, expiresInSeconds);

    return {
      code: 200,
      message: "Upload URL generated successfully.",
      data: {
        uploadUrl: presigned.url,
        method: "PUT",
        fileKey,
        bucket,
        // Bucket-relative key the app persists as `p`; rendered as
        // `${img_domain}${p}` where img_domain already includes /buckets/<bucket>/objects.
        objectPath: `/${fileKey}`,
        publicUrl: isPublic ? publicUrlFor(fileKey) : null,
        isPublic,
        // Merge into the PUT request headers. `X-S3Bender-Public: true` marks the
        // object world-readable at write time (visibility is replaced on every PUT).
        uploadHeaders: isPublic ? { "X-S3Bender-Public": "true" } : {},
        expiresIn: expiresInSeconds,
        expiresAt: presigned.expiresAt ?? null,
      },
    };
  } catch (err) {
    tools.serverLog(`handleFileUpload error: ${err}`, "handleFileUpload-100");
    // @ts-ignore
    if (err?.code === "ECONNREFUSED" || err?.cause?.code === "ECONNREFUSED") {
      return { code: 503, message: "Storage service unavailable." };
    }

    return response;
  }
}
