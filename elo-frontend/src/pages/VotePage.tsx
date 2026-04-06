import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const STORAGE_KEY = "elo_rater_session";

interface Innovation { id: string; title: string; problem: string; description: string; }
interface Progress { total_pairs: number; completed_pairs: number; percent: number; is_complete: boolean; }
type VoteState = "loading" | "voting" | "submitting" | "complete" | "error";

export default function VotePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<VoteState>("loading");
  const [pairA, setPairA] = useState<Innovation | null>(null);
  const [pairB, setPairB] = useState<Innovation | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rankings, setRankings] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [raterName, setRaterName] = useState("");
  const prefetchedRef = useRef<{ a: Innovation; b: Innovation } | null>(null);

  const loadNextPair = useCallback(async () => {
    if (!token) return;
    setState("loading");
    try {
      const res = await api.getNextPair(token);
      setProgress(res.progress);
      if (res.complete) { setRankings(res.rankings || []); setState("complete"); }
      else { setPairA(res.innovation_a!); setPairB(res.innovation_b!); setState("voting"); }
    } catch (err: any) { setError(err.message || "Fehler beim Laden."); setState("error"); }
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) { try { setRaterName(JSON.parse(stored).name || ""); } catch {} }
    loadNextPair();
  }, [loadNextPair]);

  // Prefetch the next pair in the background as soon as a pair is displayed
  useEffect(() => {
    if (state !== "voting" || !token) return;
    prefetchedRef.current = null;
    api.getNextPair(token).then(res => {
      if (!res.complete && res.innovation_a && res.innovation_b) {
        prefetchedRef.current = { a: res.innovation_a, b: res.innovation_b };
      }
    }).catch(() => {});
  }, [pairA?.id, pairB?.id]);

  const handleVote = async (winner: Innovation, loser: Innovation) => {
    if (state !== "voting" || !token) return;

    // Show the prefetched pair immediately — no waiting
    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    if (prefetched) {
      setPairA(prefetched.a);
      setPairB(prefetched.b);
    }
    setState("submitting");

    try {
      const voteRes = await api.submitVote(token, winner.id, loser.id);
      setProgress(voteRes.progress);
      const nextRes = await api.getNextPair(token);

      if (nextRes.complete) {
        setRankings(nextRes.rankings || []);
        setState("complete");
      } else {
        // Correct pair if prefetch differed (silent update, usually a no-op)
        setPairA(nextRes.innovation_a!);
        setPairB(nextRes.innovation_b!);
        setState("voting");
      }
    } catch (err: any) { setError(err.message || "Fehler beim Absenden."); setState("error"); }
  };

  if (state === "loading") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="hy-logo"><div className="hy-logo-mark">hy</div><span className="hy-logo-text">Opportunity Ranker</span></div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Wird geladen…</div>
      </div>
    </div>
  );

  if (state === "error") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="hy-logo"><div className="hy-logo-mark">hy</div><span className="hy-logo-text">Opportunity Ranker</span></div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 380, textAlign: "center" }}>
          <p style={{ color: "var(--danger)", marginBottom: 20 }}>{error}</p>
          <button className="btn-primary" onClick={() => { localStorage.removeItem(STORAGE_KEY); navigate("/"); }}>Zurück zum Start</button>
        </div>
      </div>
    </div>
  );

  if (state === "complete") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="hy-logo"><div className="hy-logo-mark">hy</div><span className="hy-logo-text">Opportunity Ranker</span></div>
      </div>
      <div style={{ background: "var(--bg-navy)", padding: "40px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
        <h1 style={{ color: "white", fontSize: 24, marginBottom: 8 }}>Rangierung abgeschlossen{raterName ? `, ${raterName}` : ""}!</h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>Ihre persönliche Rangierung basierend auf allen Vergleichen</p>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "32px 24px" }}>
        <div style={{ width: "100%", maxWidth: 520 }} className="fade-up">
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {rankings.map((item: any, i: number) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                borderBottom: i < rankings.length - 1 ? "1px solid var(--border-light)" : "none",
                background: i === 0 ? "var(--accent-bg)" : "white",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: i === 0 ? "var(--accent)" : i < 3 ? "var(--bg-navy)" : "var(--bg-steel)",
                  color: i === 0 ? "var(--text)" : i < 3 ? "white" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: i < 3 ? 600 : 400, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.title}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{Math.round(item.rating)}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 20 }}>
            Ihre Ergebnisse sind gespeichert. Der Sitzungsadministrator kann die Gesamtrankings anzeigen.
          </p>
        </div>
      </div>
    </div>
  );

  const pct = progress?.percent ?? 0;
  const total = progress?.total_pairs ?? 1;
  const done = progress?.completed_pairs ?? 0;
  const canVote = state === "voting";

  const splitContent = (item: Innovation | null) => {
    if (!item) return { problem: "", description: "" };
    const parts = item.description?.split("\n\n---\n\n");
    return parts?.length === 2
      ? { problem: parts[0], description: parts[1] }
      : { problem: "", description: item.description ?? "" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div className="topbar">
        <div className="hy-logo"><div className="hy-logo-mark">hy</div><span className="hy-logo-text">Opportunity Ranker</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {raterName && <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{raterName}</span>}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{done}/{total}</span>
          <div className="progress-track" style={{ width: 72 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Question header */}
      <div style={{ background: "var(--bg-navy)", padding: "24px 24px 28px", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Vergleich {done + 1} von {total}
        </p>
        <h2 style={{ color: "white", fontSize: 18, fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Welche Opportunity ist strategisch vielversprechender?
        </h2>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, padding: "20px 16px 32px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {([["a", pairA!, pairB!], ["b", pairB!, pairA!]] as const).map(([side, item, other]) => {
            const { problem, description } = splitContent(item);
            return (
            <button
              key={`${side}-${item?.id}`}
              onClick={() => item && other && handleVote(item, other)}
              disabled={!canVote}
              style={{
                background: "white",
                border: "2px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px 22px",
                textAlign: "left",
                cursor: canVote ? "pointer" : "default",
                width: "100%",
                transition: "none",
                boxShadow: "var(--shadow)",
                opacity: canVote ? 1 : 0.6,
              }}
              onMouseEnter={e => {
                if (!canVote) return;
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bg-navy)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(26,58,92,0.12)";
              }}
              onMouseLeave={e => {
                if (!canVote) return;
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow)";
              }}
            >
              {/* Badge + Title */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "var(--radius)", flexShrink: 0, marginTop: 2,
                  background: "var(--bg-steel)", border: "1.5px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "var(--bg-navy)",
                }}>
                  {side.toUpperCase()}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--text)", lineHeight: 1.35 }}>
                  {item?.title}
                </div>
              </div>

              {/* Problem */}
              {problem && (
                <div style={{ marginBottom: description ? 12 : 0, paddingLeft: 38 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)", marginBottom: 4 }}>
                    Problem
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {problem}
                  </div>
                </div>
              )}

              {/* Description */}
              {description && (
                <div style={{ paddingLeft: 38 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--text-muted)", marginBottom: 4 }}>
                    Ansatz
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {description}
                  </div>
                </div>
              )}
            </button>
          );
          })}

          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
            Tippen Sie auf die Karte, die strategisch vielversprechender wirkt
          </p>
        </div>
      </div>
    </div>
  );
}
