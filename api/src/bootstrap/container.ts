import type {
  IConfigAdapter,
  IPersistenceAdapter,
  IStorageAdapter,
  ILogStorageAdapter,
  IArtifactStorageAdapter,
  ISecretsAdapter,
} from "../domain/index.js";
import {
  EnvConfigAdapter,
  MongoPersistenceAdapter,
  SqlitePersistenceAdapter,
  LocalStorageAdapter,
  LocalLogStorageAdapter,
  LocalArtifactStorageAdapter,
  S3LogStorageAdapter,
  S3ArtifactStorageAdapter,
  MemorySecretsAdapter,
} from "../infrastructure/index.js";

export interface IApplicationContainer {
  readonly config: IConfigAdapter;
  readonly persistence: IPersistenceAdapter;
  readonly storage: IStorageAdapter;
  readonly logStorage: ILogStorageAdapter;
  readonly artifactStorage: IArtifactStorageAdapter;
  readonly secrets: ISecretsAdapter;
}

class ApplicationContainer implements IApplicationContainer {
  readonly config: IConfigAdapter;
  readonly persistence: IPersistenceAdapter;
  readonly storage: IStorageAdapter;
  readonly logStorage: ILogStorageAdapter;
  readonly artifactStorage: IArtifactStorageAdapter;
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
    
    const storageType = this.config.getStorageType();
    const s3Config = this.config.getS3Config();
    
    if ((storageType === "s3" || storageType === "minio") && s3Config) {
      this.logStorage = new S3LogStorageAdapter(
        s3Config.region,
        s3Config.bucket,
        s3Config.prefix,
        s3Config.endpoint,
        s3Config.accessKeyId && s3Config.secretAccessKey
          ? { accessKeyId: s3Config.accessKeyId, secretAccessKey: s3Config.secretAccessKey }
          : undefined,
        s3Config.forcePathStyle
      );
      this.artifactStorage = new S3ArtifactStorageAdapter(
        s3Config.region,
        s3Config.bucket,
        s3Config.prefix,
        s3Config.endpoint,
        s3Config.accessKeyId && s3Config.secretAccessKey
          ? { accessKeyId: s3Config.accessKeyId, secretAccessKey: s3Config.secretAccessKey }
          : undefined,
        s3Config.forcePathStyle
      );
    } else {
      this.logStorage = new LocalLogStorageAdapter(this.config.getLogsDirectory());
      this.artifactStorage = new LocalArtifactStorageAdapter(this.config.getStorageDirectory());
    }

    this.secrets = new MemorySecretsAdapter();
  }
}

export const container: IApplicationContainer = new ApplicationContainer();

