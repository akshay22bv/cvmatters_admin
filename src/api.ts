import { clearToken, readToken, writeToken } from "./session";

export type Account = { id: string; email: string; name: string };

export type AdminStats = {
  users: number;
  resumes: number;
  public_resumes: number;
  paid_orders: number;
  active_subs: number;
  ratings: number;
  sessions: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  resume_count: number;
};

export type AdminResumeRow = {
  id: string;
  templateId: string;
  category: string;
  isPublic: boolean;
  slug: string | null;
  fullName: string;
  ownerKey: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  updatedAt: string;
  createdAt: string;
};

class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed (${response.status})`, response.status, body.code || "");
  }
  return response.json();
}

export async function loadMe() {
  return request<{ user: Account; isAdmin: boolean }>("/api/auth/me");
}

export async function signIn(email: string, password: string) {
  const result = await request<{ token: string; user: Account; isAdmin?: boolean }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, ownerKey: "admin-console" }),
  });
  writeToken(result.token);
  return result;
}

export function signOut() {
  clearToken();
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => ({ ok: true }));
}

export function adminStats() {
  return request<AdminStats>("/api/admin/stats");
}

export function adminListUsers(params: { q?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.page != null) query.set("page", String(params.page));
  if (params.limit != null) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query}` : "";
  return request<{ users: AdminUserRow[]; total: number }>(`/api/admin/users${suffix}`);
}

export function adminListResumes(params: { q?: string; page?: number; limit?: number; public?: string }) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.page != null) query.set("page", String(params.page));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.public) query.set("public", params.public);
  const suffix = query.toString() ? `?${query}` : "";
  return request<{ resumes: AdminResumeRow[]; total: number }>(`/api/admin/resumes${suffix}`);
}

export function adminUpdateResume(id: string, body: { isPublic?: boolean }) {
  return request<unknown>(`/api/admin/resumes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function adminDeleteResume(id: string) {
  return request<{ ok: true }>(`/api/admin/resumes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function adminDeleteUser(id: string) {
  return request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export { ApiError };
