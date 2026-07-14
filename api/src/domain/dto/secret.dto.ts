export interface SecretDTO {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretWithEncryptedValueDTO extends SecretDTO {
  encryptedValue: string;
}
