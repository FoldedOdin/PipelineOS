import { describe } from "vitest";
import mongoose from "mongoose";
import { MongoPersistenceAdapter } from "./MongoPersistenceAdapter.js";
import { describeRepositoryContract } from "../describeRepositoryContract.js";

const uri = process.env.TEST_MONGODB_URI ?? process.env.MONGODB_URI;

describe.runIf(Boolean(uri))("MongoPersistenceAdapter Contract", () => {
  describeRepositoryContract(
    "MongoPersistenceAdapter",
    async () => {
      process.env.MONGODB_URI = uri;
      return new MongoPersistenceAdapter();
    },
    async () => {
      if (mongoose.connection.db) {
        await mongoose.connection.db.dropDatabase();
      }
    },
  );
});
