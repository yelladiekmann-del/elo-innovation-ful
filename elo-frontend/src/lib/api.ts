/// <reference types="vite/client" />

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

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

export interface Innovation { id: string; title: string; description: string; }
export interface Progress { total_pairs: number; completed_pairs: number; percent: number; is_complete: boolean; }
export interface RankingItem { rank: number; id: string; title: string; description: string; rating: number; }
export interface AggregateRankingItem { rank: number; id: string; title: string; description: string; mean_rating: number; std_dev: number; num_raters: number; }
export interface IndividualRanking { rater_name: string; rankings: { rank: number; id: string; title: string; rating: number }[]; }

export const api = {
  checkRoom: (code: string) => request<{ valid: boolean; title: string; innovation_count: number }>(`/join/${code}`),
  joinSession: (code: string, name: string) => request<{ token: string; rater_name: string; room_code: string }>(`/join/${code}`, { method: "POST", body: JSON.stringify({ name }) }),
  getNextPair: (token: string) => request<{ complete: boolean; innovation_a?: Innovation; innovation_b?: Innovation; progress: Progress; rankings?: RankingItem[]; }>(`/vote/${token}/next`),
  submitVote: (token: string, winnerId: string, loserId: string) => request<{ success: boolean; progress: Progress }>(`/vote`, { method: "POST", body: JSON.stringify({ token, winner_id: winnerId, loser_id: loserId }) }),
  getMyRankings: (token: string) => request<{ rater_name: string; session_title: string; progress: Progress; rankings: RankingItem[] }>(`/vote/${token}/rankings`),
  createSession: (title: string, adminPassword: string, innovations: Innovation[]) => request<{ room_code: string; title: string; innovation_count: number }>(`/sessions`, { method: "POST", body: JSON.stringify({ title, admin_password: adminPassword, innovations }) }),
  getSessionInfo: (code: string, pw: string) => request<{ room_code: string; title: string; innovation_count: number; innovations: Innovation[]; created_at: string; raters: { id: number; name: string; joined_at: string; total_pairs: number; completed_pairs: number; percent: number; is_complete: boolean; }[]; }>(`/sessions/${code}?admin_password=${encodeURIComponent(pw)}`),
  getAggregateRankings: (code: string, pw: string) => request<{ session_title: string; total_raters: number; raters_with_votes: number; aggregate_rankings: AggregateRankingItem[]; individual_rankings: IndividualRanking[]; }>(`/sessions/${code}/rankings?admin_password=${encodeURIComponent(pw)}`),
  listSessions: () => request<Array<{ room_code: string; title: string; innovation_count: number; created_at: string; is_active: boolean }>>('/sessions'),
};
