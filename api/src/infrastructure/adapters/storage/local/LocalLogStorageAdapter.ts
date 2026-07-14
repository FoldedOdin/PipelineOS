import fs from "node:fs/promises";
import path from "node:path";
import type { ILogStorageAdapter } from "../../../../domain/index.js";

export class LocalLogStorageAdapter implements ILogStorageAdapter {
  constructor(private readonly baseDir: string) {}

  private getLogPath(runId: string, stageName: string): string {
    return path.join(this.baseDir, "logs", `${runId}_${stageName}.log`);
  }

  async append(runId: string, stageName: string, chunk: string): Promise<void> {
    const fullPath = this.getLogPath(runId, stageName);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, chunk, "utf-8");
  }

  async read(runId: string, stageName: string): Promise<string> {
    const fullPath = this.getLogPath(runId, stageName);
    try {
      return await fs.readFile(fullPath, "utf-8");
    } catch {
      return "";
    }
  }

  async delete(runId: string): Promise<boolean> {
    const dir = path.join(this.baseDir, "logs");
    try {
      const files = await fs.readdir(dir);
      const prefix = `${runId}_`;
      let deletedAny = false;
      for (const file of files) {
        if (file.startsWith(prefix)) {
          await fs.unlink(path.join(dir, file)).catch(() => undefined);
          deletedAny = true;
        }
      }
      return deletedAny;
    } catch {
      return false;
    }
  }
}
