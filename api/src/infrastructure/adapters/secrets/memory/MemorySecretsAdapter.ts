import crypto from "node:crypto";
import { encryptSecret } from "../../../../services/cryptoService.js";
import type {
  ISecretsAdapter,
  SecretDTO,
  SecretWithEncryptedValueDTO,
} from "../../../../domain/index.js";

interface InternalSecret {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  encryptedValue: string;
}

export class MemorySecretsAdapter implements ISecretsAdapter {
  private readonly secretsMap = new Map<string, InternalSecret>();

  async upsert(name: string, value: string): Promise<SecretDTO> {
    const existing = Array.from(this.secretsMap.values()).find((s) => s.name === name);
    const now = new Date().toISOString();
    const encryptedValue = encryptSecret(value);

    if (existing) {
      existing.encryptedValue = encryptedValue;
      existing.updatedAt = now;
      return {
        id: existing.id,
        name: existing.name,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    const id = crypto.randomUUID();
    const secret: InternalSecret = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      encryptedValue,
    };
    this.secretsMap.set(id, secret);
    return {
      id: secret.id,
      name: secret.name,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    };
  }

  async get(nameOrId: string): Promise<SecretDTO | null> {
    const secret =
      this.secretsMap.get(nameOrId) ??
      Array.from(this.secretsMap.values()).find((s) => s.name === nameOrId);
    if (!secret) return null;
    return {
      id: secret.id,
      name: secret.name,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    };
  }

  async getEncrypted(nameOrId: string): Promise<SecretWithEncryptedValueDTO | null> {
    const secret =
      this.secretsMap.get(nameOrId) ??
      Array.from(this.secretsMap.values()).find((s) => s.name === nameOrId);
    if (!secret) return null;
    return {
      id: secret.id,
      name: secret.name,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      encryptedValue: secret.encryptedValue,
    };
  }

  async delete(nameOrId: string): Promise<boolean> {
    if (this.secretsMap.has(nameOrId)) {
      return this.secretsMap.delete(nameOrId);
    }
    const secret = Array.from(this.secretsMap.values()).find((s) => s.name === nameOrId);
    if (secret) {
      return this.secretsMap.delete(secret.id);
    }
    return false;
  }

  async listPublic(): Promise<SecretDTO[]> {
    return Array.from(this.secretsMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }
}
