import type { SuyoApi } from "./SuyoApi.ts";

// Copies a Tinder user's photos into Suyo storage via presigned uploads.
export class PhotoUploader {
  private static readonly EXTENSION_BY_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
  };
  private static readonly MAX_BYTES = 10 * 1024 * 1024;

  private readonly api: SuyoApi;
  private readonly minPhotos: number;
  private readonly maxPhotos: number;

  constructor(api: SuyoApi, minPhotos: number, maxPhotos: number) {
    this.api = api;
    this.minPhotos = minPhotos;
    this.maxPhotos = maxPhotos;
  }

  /** Uploads a Tinder user's photos; returns their object paths in order. */
  async uploadUserPhotos(u: any): Promise<string[]> {
    const photoUrls = (u.photos ?? [])
      .map((photo: any) => photo?.url)
      .filter(
        (url: unknown): url is string => typeof url === "string" && url.length > 0,
      )
      .slice(0, this.maxPhotos);
    if (photoUrls.length < this.minPhotos) {
      throw new Error(
        `profile has ${photoUrls.length} photos; at least ${this.minPhotos} are required`,
      );
    }

    const paths: string[] = [];
    for (const photoUrl of photoUrls) paths.push(await this.upload(photoUrl));
    return paths;
  }

  // Fetch a Tinder photo, get a presigned upload URL, then PUT the bytes.
  private async upload(photoUrl: string): Promise<string> {
    const sourceResponse = await fetch(photoUrl);
    if (!sourceResponse.ok) {
      throw new Error(`photo fetch failed (HTTP ${sourceResponse.status})`);
    }

    const contentType = (sourceResponse.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const extension = PhotoUploader.EXTENSION_BY_MIME[contentType];
    if (!extension) {
      throw new Error(`unsupported photo content type: ${contentType || "unknown"}`);
    }

    const photo = await sourceResponse.arrayBuffer();
    if (photo.byteLength === 0 || photo.byteLength > PhotoUploader.MAX_BYTES) {
      throw new Error(`photo size is invalid (${photo.byteLength} bytes)`);
    }

    const presigned = await this.api.presignUpload(extension, photo.byteLength);

    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: presigned.method ?? "PUT",
      headers: {
        "Content-Type": contentType,
        ...(presigned.uploadHeaders ?? {}),
      },
      body: photo,
    });
    if (!uploadResponse.ok) {
      throw new Error(`photo upload failed (HTTP ${uploadResponse.status})`);
    }

    const objectPath =
      presigned.objectPath ?? (presigned.fileKey ? `/${presigned.fileKey}` : null);
    if (!objectPath) throw new Error("presign response did not include an object path");
    return objectPath;
  }
}
