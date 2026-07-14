import type {
  IConfigAdapter,
  IPersistenceAdapter,
  IStorageAdapter,
  ILogStorageAdapter,
  ISecretsAdapter,
} from "../domain/index.js";
import {
  EnvConfigAdapter,
  MongoPersistenceAdapter,
  SqlitePersistenceAdapter,
  LocalStorageAdapter,
  LocalLogStorageAdapter,
  MemorySecretsAdapter,
} from "../infrastructure/index.js";

export interface IApplicationContainer {
  readonly config: IConfigAdapter;
  readonly persistence: IPersistenceAdapter;
  readonly storage: IStorageAdapter;
  readonly logStorage: ILogStorageAdapter;
  readonly secrets: ISecretsAdapter;
}

class ApplicationContainer implements IApplicationContainer {
  readonly config: IConfigAdapter;
  readonly persistence: IPersistenceAdapter;
  readonly storage: IStorageAdapter;
  readonly logStorage: ILogStorageAdapter;
  readonly secrets: ISecretsAdapter;

  constructor() {
    this.config = new EnvConfigAdapter();
    const provider = this.config.getDatabaseProvider();
    if (provider === "mongodb") {
      this.persistence = new MongoPersistenceAdapter();
    } else {
      this.persistence = new SqlitePersistenceAdapter(this.config);
    }
    this.storage = new LocalStorageAdapter(this.config.getStorageDirectory());
    this.logStorage = new LocalLogStorageAdapter(this.config.getLogsDirectory());
    this.secrets = new MemorySecretsAdapter();
  }
}

export const container: IApplicationContainer = new ApplicationContainer();

