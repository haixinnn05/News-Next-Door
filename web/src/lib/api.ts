import type { AppAudioView, Board, DistrictGeometry, FollowResponse, Meta, MyProposals, ProposalDetail, SearchResponse, ZapApplication, ZapFeed } from "./types";

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
  boards: () => request<{ default_id: string; boards: Board[] }>("/api/boards"),
  boundary: (boardId: string) => request<{ board_id: string; geometry: DistrictGeometry }>(`/api/boards/${encodeURIComponent(boardId)}/boundary`),
  applications: (boardId: string) => request<ZapFeed>(`/api/applications?board=${encodeURIComponent(boardId)}`),
  application: (id: string) => request<ZapApplication>(`/api/applications/${encodeURIComponent(id)}`),
  summarize: (id: string, language: string) => request<{ summary: string; model: string }>(`/api/applications/${encodeURIComponent(id)}/summarize`, json("POST", { language })),
  appAudio: (id: string) => request<AppAudioView>(`/api/applications/${encodeURIComponent(id)}/audio`),
  requestAppAudio: (id: string, language: "en" | "zh") => request<AppAudioView>(`/api/applications/${encodeURIComponent(id)}/audio`, json("POST", { language })),
  followApp: (id: string, language: string) => request<FollowResponse>(`/api/applications/${encodeURIComponent(id)}/follow`, json("POST", { language })),
  proposal: (id: string) => request<ProposalDetail>(`/api/proposals/${id}`),
  follow: (id: string, language: string) => request<FollowResponse>(`/api/proposals/${id}/follow`, json("POST", { language })),
  followStatus: (code: string) => request<{ status: "waiting" | "confirmed" | "expired" | "unknown" }>(`/api/follow/${code}`),
  simSend: (handle: string, text: string) => request<{ action: string }>("/api/sim/inbound", json("POST", { handle, text })),
  myProposals: () => request<MyProposals>("/api/me/proposals"),
  setSaved: (id: string, saved: boolean) => request<{ ok: true }>(`/api/me/saved/${encodeURIComponent(id)}`, { method: saved ? "PUT" : "DELETE" }),
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
  const token = adminToken.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return request<T>(`/api/admin${path}`, { ...init, headers });
}
export const adminJson = <T,>(method: string, path: string, data?: unknown) => adminRequest<T>(path, json(method, data));
