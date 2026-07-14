import type { Buffer } from "node:buffer";
import type { Readable, Writable } from "node:stream";

export interface IStorageAdapter {
  write(path: string, content: Buffer | string): Promise<void>;
  read(path: string): Promise<Buffer>;
  delete(path: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  createDirectory(path: string): Promise<void>;
  createReadStream(path: string): Readable;
  createWriteStream(path: string): Writable;
}
