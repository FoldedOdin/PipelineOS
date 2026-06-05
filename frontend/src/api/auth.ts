import { apiPostJson } from "./client";

export async function login(password: string): Promise<void> {
  await apiPostJson("/api/auth/login", { username: "admin", password });
}

export async function logout(): Promise<void> {
  await apiPostJson("/api/auth/logout", {});
}
