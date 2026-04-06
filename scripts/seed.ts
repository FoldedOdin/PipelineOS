import "dotenv/config";
import pino from "pino";

const logger = pino({ level: "info" });

/**
 * Inserts sample pipeline and run documents for local development.
 * Expanded once models and services stabilize.
 */
async function main(): Promise<void> {
  logger.info("seed scaffold: connect and insert sample data in a later milestone");
}

main().catch((err: unknown) => {
  logger.error({ err }, "seed failed");
  process.exit(1);
});
