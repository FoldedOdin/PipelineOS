import type { SecretDTO, SecretWithEncryptedValueDTO } from "../../dto/index.js";

export interface ISecretsAdapter {
  upsert(name: string, value: string): Promise<SecretDTO>;
  get(name: string): Promise<SecretDTO | null>;
  getEncrypted(name: string): Promise<SecretWithEncryptedValueDTO | null>;
  delete(name: string): Promise<boolean>;
  listPublic(): Promise<SecretDTO[]>;
}
