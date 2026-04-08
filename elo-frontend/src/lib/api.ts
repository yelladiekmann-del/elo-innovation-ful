/// <reference types="vite/client" />

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

// ── Generic helpers ───────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json() as Promise<T>;
}

// JWT stored per room code so multiple sessions don't conflict
export function setAdminToken(roomCode: string, token: string): void {
  localStorage.setItem(`elo_admin_token_${roomCode}`, token);
}

export function clearAdminToken(roomCode: string): void {
  localStorage.removeItem(`elo_admin_token_${roomCode}`);
}

function getAdminToken(roomCode: string): string | null {
  return localStorage.getItem(`elo_admin_token_${roomCode}`);
}

async function adminRequest<T>(roomCode: string, path: string, options?: RequestInit): Promise<T> {
  const token = getAdminToken(roomCode);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Innovation { id: string; title: string; problem: string; description: string; }
export interface Progress { total_pairs: number; completed_pairs: number; percent: number; is_complete: boolean; }
export interface RankingItem { rank: number; id: string; title: string; description: string; rating: number; }
export interface AggregateRankingItem { rank: number; id: string; title: string; description: string; mean_rating: number; std_dev: number; num_raters: number; }
export interface IndividualRanking { rater_name: string; rankings: { rank: number; id: string; title: string; rating: number }[]; }
export interface SessionListItem { room_code: string; title: string; innovation_count: number; created_at: string; is_active: boolean; }

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  // Rater endpoints — unchanged
  checkRoom: (code: string) =>
    request<{ valid: boolean; title: string; innovation_count: number }>(`/join/${code}`),
  joinSession: (code: string, name: string) =>
    request<{ token: string; rater_name: string; room_code: string }>(`/join/${code}`, {
      method: "POST", body: JSON.stringify({ name }),
    }),
  getNextPair: (token: string) =>
    request<{ complete: boolean; innovation_a?: Innovation; innovation_b?: Innovation; progress: Progress; rankings?: RankingItem[] }>(`/vote/${token}/next`),
  submitVote: (token: string, winnerId: string, loserId: string) =>
    request<{ success: boolean; progress: Progress }>(`/vote`, {
      method: "POST", body: JSON.stringify({ token, winner_id: winnerId, loser_id: loserId }),
    }),
  getMyRankings: (token: string) =>
    request<{ rater_name: string; session_title: string; progress: Progress; rankings: RankingItem[] }>(`/vote/${token}/rankings`),

  // Admin: auth
  adminLogin: (roomCode: string, password: string) =>
    request<{ token: string; room_code: string; title: string }>(`/admin/login`, {
      method: "POST", body: JSON.stringify({ room_code: roomCode, password }),
    }),

  // Admin: session list (public)
  listSessions: () =>
    request<SessionListItem[]>('/sessions'),

  // Admin: create session (no JWT needed, protected by knowing the password)
  createSession: (title: string, adminPassword: string, innovations: Innovation[]) =>
    request<{ room_code: string; title: string; innovation_count: number }>(`/sessions`, {
      method: "POST", body: JSON.stringify({ title, admin_password: adminPassword, innovations }),
    }),

  // Admin: protected endpoints (require JWT)
  getSessionInfo: (code: string) =>
    adminRequest<{
      room_code: string; title: string; innovation_count: number;
      innovations: Innovation[]; created_at: string; is_active: boolean;
      raters: { id: number; name: string; joined_at: string; total_pairs: number; completed_pairs: number; percent: number; is_complete: boolean }[];
    }>(code, `/sessions/${code}`),

  getAggregateRankings: (code: string) =>
    adminRequest<{
      session_title: string; total_raters: number; raters_with_votes: number;
      aggregate_rankings: AggregateRankingItem[]; individual_rankings: IndividualRanking[];
    }>(code, `/sessions/${code}/rankings`),

  patchSession: (code: string, isActive: boolean) =>
    adminRequest<{ room_code: string; is_active: boolean }>(code, `/sessions/${code}`, {
      method: "PATCH", body: JSON.stringify({ is_active: isActive }),
    }),

  deleteSession: (code: string) =>
    adminRequest<{ deleted: string }>(code, `/sessions/${code}`, { method: "DELETE" }),

  exportCsv: async (code: string): Promise<void> => {
    const token = getAdminToken(code);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}/sessions/${code}/export`, { headers });
    if (!res.ok) throw new Error("Export fehlgeschlagen");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rankings_${code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
