import { SqlitePersistenceAdapter } from "./SqlitePersistenceAdapter.js";
import { describeRepositoryContract } from "../describeRepositoryContract.js";

describeRepositoryContract(
  "SqlitePersistenceAdapter",
  async () => new SqlitePersistenceAdapter(":memory:"),
  async () => {
    // no-op cleanup
  },
);
