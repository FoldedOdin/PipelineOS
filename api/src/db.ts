import type { Logger } from "pino";
import { container } from "./bootstrap/index.js";

/**
 * Establishes database connection and runs any necessary migrations
 * using the configured persistence adapter (SQLite or MongoDB).
 */
export async function connectDb(logger: Logger): Promise<void> {
  await container.persistence.connect(logger);
  await container.persistence.migrate();
}
