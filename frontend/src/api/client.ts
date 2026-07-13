function apiBaseUrl(): string {
  return import.meta.env.VITE_API_URL;
}

/**
 * Performs a GET request against the API and returns parsed JSON as `unknown` for safe narrowing later.
 */
export async function apiGetJson(path: string): Promise<unknown> {
  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401) {
    window.location.href = "/login";
    return new Promise(() => undefined); // never resolve to stop execution
  }
  if (!response.ok) {
    const status = String(response.status);
    const statusText = response.statusText;
    throw new Error(`request failed: ${status} ${statusText}`);
  }
  const body: unknown = await response.json();
  return body;
}

export async function apiPostJson(path: string, body: unknown): Promise<unknown> {
  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (response.status === 401) {
    window.location.href = "/login";
    return new Promise(() => undefined);
  }
  if (!response.ok) {
    const status = String(response.status);
    const statusText = response.statusText;
    throw new Error(`request failed: ${status} ${statusText}`);
  }
  return (await response.json()) as unknown;
}

export async function apiDelete(path: string): Promise<void> {
  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url, { method: "DELETE", credentials: "include" });
  if (response.status === 401) {
    window.location.href = "/login";
    return new Promise(() => undefined);
  }
  if (!response.ok && response.status !== 204) {
    throw new Error(`request failed: ${String(response.status)} ${response.statusText}`);
  }
}
