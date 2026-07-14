import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import type { Readable, Writable } from "node:stream";
import path from "node:path";
import type { Buffer } from "node:buffer";
import type { IStorageAdapter } from "../../../../domain/index.js";

export class LocalStorageAdapter implements IStorageAdapter {
  constructor(private readonly baseDir: string) {}

  private resolvePath(relativePath: string): string {
    return path.join(this.baseDir, relativePath);
  }

  async write(relativePath: string, content: Buffer | string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(relativePath);
    return fs.readFile(fullPath);
  }

  async delete(relativePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(relativePath: string): Promise<void> {
    const fullPath = this.resolvePath(relativePath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  createReadStream(relativePath: string): Readable {
    const fullPath = this.resolvePath(relativePath);
    return createReadStream(fullPath);
  }

  createWriteStream(relativePath: string): Writable {
    const fullPath = this.resolvePath(relativePath);
    return createWriteStream(fullPath);
  }
}
