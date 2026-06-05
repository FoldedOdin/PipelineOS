import { encryptSecret, decryptSecret } from "../services/cryptoService.js";

export interface Secret {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  encryptedValue: string;
}

const secretsMap = new Map<string, Secret>();

export const secretModel = {
  createSecret(name: string, value: string): Secret {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const secret: Secret = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      encryptedValue: encryptSecret(value),
    };
    secretsMap.set(id, secret);
    return secret;
  },

  listSecrets(): Omit<Secret, "encryptedValue">[] {
    return Array.from(secretsMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  },

  getDecryptedSecret(name: string): string | null {
    const secret = Array.from(secretsMap.values()).find((s) => s.name === name);
    if (!secret) return null;
    try {
      return decryptSecret(secret.encryptedValue);
    } catch {
      return null;
    }
  },

  getAllDecryptedSecrets(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const secret of secretsMap.values()) {
      try {
        result[secret.name] = decryptSecret(secret.encryptedValue);
      } catch {
        // ignore decryption failures
      }
    }
    return result;
  },

  deleteSecret(id: string): boolean {
    return secretsMap.delete(id);
  },
};
