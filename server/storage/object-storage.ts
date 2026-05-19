import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Client as ObjectStorageClient } from "@replit/object-storage";

const RAW_MODE = (process.env.STORAGE_ADAPTER_MODE ?? "mock").toLowerCase();
const MODE: "mock" | "object" = RAW_MODE === "mock" || RAW_MODE === "local" ? "mock" : "object";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
]);

export const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const ALLOWED_VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mov", ".webm",
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_FILES_PER_REQUEST = 5;

export interface UploadInput {
  buffer: Buffer;
  mime: string;
  originalName: string;
  folder: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mime: string;
  originalName: string;
}

function safeExt(originalName: string, mime: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) return ext;
  if (ALLOWED_VIDEO_EXTENSIONS.has(ext)) return ext;
  switch (mime) {
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "image/gif": return ".gif";
    case "image/webp": return ".webp";
    case "image/heic": return ".heic";
    case "image/heif": return ".heif";
    case "video/mp4": return ".mp4";
    case "video/quicktime": return ".mov";
    case "video/webm": return ".webm";
    default: return ".bin";
  }
}

function generateKey(folder: string, originalName: string, mime: string): string {
  const ext = safeExt(originalName, mime);
  const ts = Date.now();
  const rand = randomBytes(6).toString("hex");
  const safeFolder = folder.replace(/[^a-z0-9_\-/]/gi, "").replace(/^\/+|\/+$/g, "") || "misc";
  return `${safeFolder}/${ts}-${rand}${ext}`;
}

// ============ Mock (local disk) adapter ============

async function uploadMock(input: UploadInput, key: string): Promise<UploadResult> {
  const fullPath = path.join(UPLOADS_ROOT, key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, input.buffer);
  // Always return the auth-gated proxy URL — even in mock mode — so that
  // facility scoping is enforced regardless of where the bytes actually live.
  // The /uploads static mount is independently blocked for the work-logs/*
  // subtree (see server/routes.ts).
  return {
    url: `/api/storage/objects/${key.split("/").map(encodeURIComponent).join("/")}`,
    key,
    size: input.buffer.byteLength,
    mime: input.mime,
    originalName: input.originalName,
  };
}

async function downloadMock(key: string): Promise<{ buffer: Buffer; mime?: string } | null> {
  const fullPath = path.join(UPLOADS_ROOT, key);
  try {
    const buffer = await fs.promises.readFile(fullPath);
    return { buffer };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

// ============ Replit Object Storage adapter ============
//
// Uses the bundled default bucket when no STORAGE_BUCKET_ID is set. Object
// Storage does not expose direct anonymous URLs, so uploads return a proxy URL
// (`/api/storage/objects/<key>`) that an authenticated download route streams
// from. This keeps photos private and facility-scoped while still being
// renderable in <img src=...>.

let _objectClient: ObjectStorageClient | null = null;
let _objectClientFailedAt: number | null = null;

async function getObjectClient(): Promise<ObjectStorageClient> {
  if (_objectClient) return _objectClient;
  // Avoid hammering retries every request — 30s back-off after a failure.
  if (_objectClientFailedAt && Date.now() - _objectClientFailedAt < 30_000) {
    throw new Error("Object Storage client unavailable (recent init failure).");
  }
  try {
    const mod = await import("@replit/object-storage");
    const bucketId = process.env.STORAGE_BUCKET_ID || undefined;
    _objectClient = new mod.Client(bucketId ? { bucketId } : undefined);
    _objectClientFailedAt = null;
    return _objectClient;
  } catch (e) {
    _objectClientFailedAt = Date.now();
    throw new Error(
      `Failed to initialise Replit Object Storage client: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function uploadObjectStorage(input: UploadInput, key: string): Promise<UploadResult> {
  const client = await getObjectClient();
  const result = await client.uploadFromBytes(key, input.buffer);
  if (!result.ok) {
    const msg = result.error instanceof Error ? result.error.message : String(result.error);
    throw new Error(`Object Storage upload failed: ${msg}`);
  }
  return {
    url: `/api/storage/objects/${key.split("/").map(encodeURIComponent).join("/")}`,
    key,
    size: input.buffer.byteLength,
    mime: input.mime,
    originalName: input.originalName,
  };
}

async function downloadObjectStorage(key: string): Promise<{ buffer: Buffer; mime?: string } | null> {
  const client = await getObjectClient();
  const exists = await client.exists(key);
  if (exists.ok && exists.value === false) return null;
  const result = await client.downloadAsBytes(key);
  if (!result.ok) {
    const msg = result.error instanceof Error ? result.error.message : String(result.error);
    if (/not found|no such object/i.test(msg)) return null;
    throw new Error(`Object Storage download failed: ${msg}`);
  }
  // The SDK returns the bytes as `value[0]` (first element of an array).
  const bytes = Array.isArray(result.value) ? (result.value[0] as Buffer | Uint8Array) : (result.value as unknown as Buffer);
  return { buffer: Buffer.from(bytes) };
}

// ============ Public API ============

export async function uploadMediaFile(input: UploadInput, opts?: { allowedMimeTypes?: Set<string>; maxBytes?: number }): Promise<UploadResult> {
  const allowed = opts?.allowedMimeTypes ?? ALLOWED_IMAGE_MIME_TYPES;
  const maxBytes = opts?.maxBytes ?? MAX_UPLOAD_BYTES;
  if (!allowed.has(input.mime)) {
    throw new Error(`不支援的檔案類型：${input.mime}`);
  }
  if (input.buffer.byteLength > maxBytes) {
    throw new Error(`檔案過大，上限 ${(maxBytes / 1024 / 1024).toFixed(0)} MB`);
  }
  const key = generateKey(input.folder, input.originalName, input.mime);
  if (MODE === "mock") return uploadMock(input, key);
  return uploadObjectStorage(input, key);
}

export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  return uploadMediaFile(input, { allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES, maxBytes: MAX_UPLOAD_BYTES });
}

/**
 * Resolve a stored object's bytes for streaming back to the browser. Returns
 * null when the object does not exist; throws on infrastructure failures.
 */
export async function downloadFile(key: string): Promise<{ buffer: Buffer; mime?: string } | null> {
  if (!key || key.includes("..") || key.startsWith("/")) {
    throw new Error("無效的物件鍵");
  }
  if (MODE === "mock") return downloadMock(key);
  return downloadObjectStorage(key);
}

export function getStorageMode(): "mock" | "object" {
  return MODE;
}

export function getPublicUrl(key: string): string {
  return `/api/storage/objects/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function inferMimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".heic": return "image/heic";
    case ".heif": return "image/heif";
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".webm": return "video/webm";
    default: return "application/octet-stream";
  }
}
