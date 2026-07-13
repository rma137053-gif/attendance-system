import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export function ensureUploadDir() {
  if (config.storageType === 'local') {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
}

/** Save a file buffer to local storage. Returns the storage key. */
export async function savePhoto(buffer: Buffer, originalName: string): Promise<string> {
  if (config.storageType === 'local') {
    const ext = path.extname(originalName) || '.jpg';
    const key = `${uuidv4()}${ext}`;
    const filePath = path.join(config.uploadDir, key);
    await fs.promises.writeFile(filePath, buffer);
    return key;
  }
  // S3 implementation would go here
  throw new Error('S3 storage not yet implemented');
}

/** Get a file buffer from local storage by key */
export async function getPhoto(key: string): Promise<Buffer> {
  if (config.storageType === 'local') {
    const filePath = path.join(config.uploadDir, key);
    return fs.promises.readFile(filePath);
  }
  throw new Error('S3 storage not yet implemented');
}

/** Delete a photo from local storage */
export async function deletePhoto(key: string): Promise<void> {
  if (config.storageType === 'local') {
    const filePath = path.join(config.uploadDir, key);
    await fs.promises.unlink(filePath).catch(() => {});
  }
}
