import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const MODE = (process.env.STORAGE_ADAPTER_MODE ?? "mock").toLowerCase();
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

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
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
  switch (mime) {
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "image/gif": return ".gif";
    case "image/webp": return ".webp";
    case "image/heic": return ".heic";
    case "image/heif": return ".heif";
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

async function uploadMock(input: UploadInput): Promise<UploadResult> {
  const key = generateKey(input.folder, input.originalName, input.mime);
  const fullPath = path.join(UPLOADS_ROOT, key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, input.buffer);
  return {
    url: `/uploads/${key}`,
    key,
    size: input.buffer.byteLength,
    mime: input.mime,
    originalName: input.originalName,
  };
}

async function uploadObjectStorage(_input: UploadInput): Promise<UploadResult> {
  // Stub for production Replit Object Storage. Until @replit/object-storage
  // is installed and a bucket is configured, fail loudly so callers do not
  // silently lose data.
  throw new Error(
    "Replit Object Storage adapter is not configured. " +
    "Set STORAGE_ADAPTER_MODE=mock for local/dev, or install @replit/object-storage and configure a bucket.",
  );
}

export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(input.mime)) {
    throw new Error(`不支援的檔案類型：${input.mime}`);
  }
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`檔案過大，上限 ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB`);
  }
  if (MODE === "mock" || MODE === "local") {
    return uploadMock(input);
  }
  return uploadObjectStorage(input);
}

export function getStorageMode(): string {
  return MODE;
}

export function getPublicUrl(key: string): string {
  if (MODE === "mock" || MODE === "local") {
    return `/uploads/${key}`;
  }
  // Real Object Storage would return a CDN URL or signed URL here.
  return `/uploads/${key}`;
}
