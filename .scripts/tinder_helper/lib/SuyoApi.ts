export type PresignedUpload = {
  uploadUrl: string;
  method?: string;
  uploadHeaders?: Record<string, string>;
  objectPath?: string;
  fileKey?: string;
};

// The Suyo API endpoints the scraper calls.
export class SuyoApi {
  private readonly apiDomain: string;

  constructor(apiDomain: string) {
    this.apiDomain = apiDomain;
  }

  /** Asks the API for a presigned URL to upload one signup photo to. */
  async presignUpload(extension: string, fileSize: number): Promise<PresignedUpload> {
    const res = await fetch(`${this.apiDomain}/api/core/v1/handleFileUpload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        meta: { extension, bucketType: "signup-void", fileSize },
      }),
    });
    if (!res.ok) throw new Error(`presign request failed (HTTP ${res.status})`);

    const result = await res.json();
    const presigned = result?.data;
    if (result?.code !== 200 || !presigned?.uploadUrl) {
      throw new Error(result?.message ?? "presign response did not include an upload URL");
    }
    return presigned;
  }
}
