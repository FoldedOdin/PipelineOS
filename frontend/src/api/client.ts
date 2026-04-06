function apiBaseUrl(): string {
  return import.meta.env.VITE_API_URL;
}

/**
 * Performs a GET request against the API and returns parsed JSON as `unknown` for safe narrowing later.
 */
export async function apiGetJson(path: string): Promise<unknown> {
  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    const status = String(response.status);
    const statusText = response.statusText;
    throw new Error(`request failed: ${status} ${statusText}`);
  }
  const body: unknown = await response.json();
  return body;
}
