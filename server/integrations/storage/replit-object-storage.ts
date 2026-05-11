import { promises as fs } from "fs";
import path from "path";
import { Client } from "@replit/object-storage";

export interface PhotoStorage {
  upload(buffer: Buffer, key: string, contentType: string): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSec: number): Promise<string>;
}

const localRoot = path.join(process.cwd(), "uploads");

const writeLocalFallback = async (buffer: Buffer, key: string): Promise<{ url: string; key: string }> => {
  const target = path.join(localRoot, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { key, url: `/uploads/${key}` };
};

const canUseReplitObjectStorage = () =>
  Boolean(process.env.REPL_ID || process.env.REPL_SLUG || process.env.REPLIT_OBJECT_STORAGE_BUCKET_ID);

export const createReplitPhotoStorage = (): PhotoStorage => {
  const client = canUseReplitObjectStorage() ? new Client() : null;

  return {
    async upload(buffer, key, contentType) {
      if (!client) {
        void contentType;
        return writeLocalFallback(buffer, key);
      }
      try {
        const result = await client.uploadFromBytes(key, buffer, { compress: false });
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        return { key, url: `/objects/${key}` };
      } catch {
        return writeLocalFallback(buffer, key);
      }
    },

    async delete(key) {
      try {
        if (client) {
          await client.delete(key, { ignoreNotFound: true });
        }
      } catch {
        await fs.rm(path.join(localRoot, key), { force: true });
      }
      if (!client) {
        await fs.rm(path.join(localRoot, key), { force: true });
      }
    },

    async getSignedUrl(key, _expiresInSec) {
      return client ? `/objects/${key}` : `/uploads/${key}`;
    },
  };
};
