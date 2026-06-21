/**
 * Typed API client  - thin wrapper over fetch.
 * Attaches the Supabase session token to every request.
 * All API calls go through /api/v1/* which Next.js proxies to the FastAPI backend.
 */
import { createBrowserClient } from "./supabase-browser";

const BASE = "/api/v1";

async function getToken(): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestInit,
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err?.detail || "API error"), {
      status: res.status,
      detail: err?.detail,
    });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Open an SSE stream, returning the raw Response (check .body for ReadableStream). */
export async function apiStream(path: string): Promise<Response> {
  const token = await getToken();
  return fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** POST with a JSON body and return an SSE stream Response. */
export async function apiStreamPost(path: string, body: unknown): Promise<Response> {
  const token = await getToken();
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),

  /** Multipart upload (for broker import files). */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = await getToken();
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw Object.assign(new Error(err?.detail || "Upload error"), { status: res.status });
    }
    return res.json();
  },
};
