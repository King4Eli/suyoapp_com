import { randomBytes } from "crypto";
import { sessions, tools } from "../../global/functions.js";
import * as Minio from "minio";

const MINIO_TOOLS = {
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || "minio",
    MINIO_PORT: parseInt(process.env.MINIO_PORT || "9000", 10),
    MINIO_USE_SSL: process.env.MINIO_USE_SSL === "true",
    MINIO_ROOT_USER: process.env.MINIO_ROOT_USER || "minioadmin",
    MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
    BUCKET_NAME: process.env.MINIO_BUCKET || "nobucket"
};

const ALLOWED_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "gif", "webp", "bmp",
    "mp4", "mov", "avi", "wmv", "flv", "webm", "mkv",
    "mp3", "wav", "m4a", "aac", "ogg", "flac",
    //"pdf", "txt"
]);

const Allowed_Bucket_Types = {
    "profile-media": (userId = "00-00") => `users/${userId}/profile_media`,
    "profile-verify": (userId = "00-00") => `users/${userId}/verify`,
    "convo-img": (convoId = "00-00") => `conversations/${convoId}/chat_img`,
    "convo-audio": (convoId = "00-00") => `conversations/${convoId}/chat_audio`,
    "convo-video": (convoId = "00-00") => `conversations/${convoId}/chat_video`,
    "signup-void": () => "signup_void",
};

const MAX_SIZES = {
    'img': 10 * 1024 * 1024,
    'audio': 50 * 1024 * 1024,
    'video': 500 * 1024 * 1024,
    'document': 25 * 1024 * 1024
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
    return 'document';
}

export default async function handleFileUpload(fileData = { extension: null, bucketType: null, convoId: null, fileSize: null }) {
    const response = {
        code: 500,
        message: "Unable to generate upload URL.5"
    };

    try {
        const fileExt = normalizeExtension(fileData?.extension);
        const convoId = fileData?.convoId;
        const bucketType = fileData?.bucketType;
        const fileSize = fileData?.fileSize;

        // Validate inputs
        if (!fileExt) {
            return { code: 400, message: "File type not allowed or invalid extension." };
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
            return { code: 400, message: "Conversation ID required for conversation uploads." };
        }

        // Validate file size
        if (fileSize) {
            const mediaType = getMediaType(fileExt);
            if (fileSize > MAX_SIZES[mediaType]) {
                return {
                    code: 400,
                    message: `File too large. Maximum size for ${mediaType} is ${MAX_SIZES[mediaType] / 1024 / 1024}MB.`
                };
            }
        }

        const minioClient = new Minio.Client({
            endPoint: MINIO_TOOLS.MINIO_ENDPOINT,
            port: MINIO_TOOLS.MINIO_PORT,
            useSSL: MINIO_TOOLS.MINIO_USE_SSL,
            accessKey: MINIO_TOOLS.MINIO_ROOT_USER,
            secretKey: MINIO_TOOLS.MINIO_ROOT_PASSWORD
        });

        const bucket = MINIO_TOOLS.BUCKET_NAME;

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
        const expiresInSeconds = 60 * 5; // 5 minutes

        // Check if bucket exists, create if it doesn't
        const bucketExists = await minioClient.bucketExists(bucket);
        if (!bucketExists) {
            await minioClient.makeBucket(bucket);
            console.log(`Bucket "${bucket}" created successfully.`);
        }

        const uploadUrl = await minioClient.presignedPutObject(
            bucket,
            fileKey,
            expiresInSeconds
        );

        return {
            code: 200,
            message: "Upload URL generated successfully.",
            data: {
                uploadUrl,
                fileKey,
                method: "PUT",
                expiresIn: expiresInSeconds,
                bucket: bucket
            }
        };
    }
    catch (err) {
        tools.serverLog(`handleFileUpload error: ${err}`,"handleFileUpload-100");
        // @ts-ignore
        if (err?.code === 'ECONNREFUSED') {
            return { code: 503, message: "Storage service unavailable." };
        }

        return response;
    }
}
