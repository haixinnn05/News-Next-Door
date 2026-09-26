import type { FollowResponse, Meta, ProposalDetail, SearchResponse, ZapFeed } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string })?.error ?? `Request failed (${res.status})`);
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  meta: () => request<Meta>("/api/meta"),
  search: (q = "", category = "all") => request<SearchResponse>(`/api/proposals?q=${encodeURIComponent(q)}&category=${category}`),
  applications: () => request<ZapFeed>("/api/applications"),
  proposal: (id: string) => request<ProposalDetail>(`/api/proposals/${id}`),
  follow: (id: string, language: string) => request<FollowResponse>(`/api/proposals/${id}/follow`, json("POST", { language })),
  followStatus: (code: string) => request<{ status: "waiting" | "confirmed" | "expired" | "unknown" }>(`/api/follow/${code}`),
  simSend: (handle: string, text: string) => request<{ action: string }>("/api/sim/inbound", json("POST", { handle, text })),
  simThread: (handle: string) => request<{ id: number; direction: "to_phone" | "from_phone"; text: string; at: string }[]>(`/api/sim/thread?handle=${encodeURIComponent(handle)}`),
};

// ---------------------------------------------------------------- admin
const TOKEN_KEY = "btv-admin-token";
export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY) ?? "",
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${adminToken.get()}`);
  return request<T>(`/api/admin${path}`, { ...init, headers });
}
export const adminJson = <T,>(method: string, path: string, data?: unknown) => adminRequest<T>(path, json(method, data));
