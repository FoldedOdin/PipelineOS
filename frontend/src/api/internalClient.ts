function internalBaseUrl(): string {
  return import.meta.env.VITE_API_URL;
}

function internalApiKey(): string {
  const key = import.meta.env.VITE_INTERNAL_API_KEY;
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("VITE_INTERNAL_API_KEY is required for internal admin requests");
  }
  return key.trim();
}

export async function internalGetJson(path: string): Promise<unknown> {
  const url = `${internalBaseUrl()}${path}`;
  const response = await fetch(url, { credentials: "include" });
  if (response.status === 401) {
    window.location.href = "/login";
    return new Promise(() => {});
  }
  if (!response.ok) {
    throw new Error(`request failed: ${String(response.status)} ${response.statusText}`);
  }
  return (await response.json()) as unknown;
}

export async function internalPostJson(path: string, body: unknown): Promise<unknown> {
  const url = `${internalBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (response.status === 401) {
    window.location.href = "/login";
    return new Promise(() => {});
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`request failed: ${String(response.status)} ${response.statusText} ${text}`);
  }
  return (await response.json()) as unknown;
}

export async function internalDelete(path: string): Promise<void> {
  const url = `${internalBaseUrl()}${path}`;
  const response = await fetch(url, { method: "DELETE", credentials: "include" });
  if (response.status === 401) {
    window.location.href = "/login";
    return new Promise(() => {});
  }
  if (!response.ok && response.status !== 204) {
    throw new Error(`request failed: ${String(response.status)} ${response.statusText}`);
  }
}

