import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const STORAGE_KEY = "elo_rater_session";

interface Innovation { id: string; title: string; problem: string; description: string; }
interface Progress { total_pairs: number; completed_pairs: number; percent: number; is_complete: boolean; }
type VoteState = "loading" | "voting" | "animating" | "complete" | "error";

export default function VotePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<VoteState>("loading");
  const [pairA, setPairA] = useState<Innovation | null>(null);
  const [pairB, setPairB] = useState<Innovation | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rankings, setRankings] = useState<any[]>([]);
  const [chosen, setChosen] = useState<"a" | "b" | null>(null);
  const [error, setError] = useState("");
  const [raterName, setRaterName] = useState("");

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

  const handleVote = async (winner: Innovation, loser: Innovation, side: "a" | "b") => {
    if (state !== "voting" || !token) return;
    setChosen(side); setState("animating");
    try {
      const voteRes = await api.submitVote(token, winner.id, loser.id);
      setProgress(voteRes.progress);
      const nextRes = await api.getNextPair(token);
      setChosen(null);
      if (nextRes.complete) { setRankings(nextRes.rankings || []); setState("complete"); }
      else { setPairA(nextRes.innovation_a!); setPairB(nextRes.innovation_b!); setState("voting"); }
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
      <div style={{ background: "var(--bg-navy)", padding: "32px 24px 36px", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          Vergleich {done + 1} von {total}
        </p>
        <h2 style={{ color: "white", fontSize: 20, fontFamily: "var(--font-display)", fontWeight: 700 }}>
          Welche Opportunity ist interessanter?
        </h2>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 20px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {([["a", pairA!, pairB!], ["b", pairB!, pairA!]] as const).map(([side, item, other]) => {
              const isChosen = chosen === side;
              const isDimmed = chosen !== null && chosen !== side;
              return (
                <button
                  key={item?.id}
                  onClick={() => item && other && handleVote(item, other, side)}
                  disabled={state !== "voting"}
                  style={{
                    background: isChosen ? "var(--bg-navy)" : "white",
                    border: `2px solid ${isChosen ? "var(--bg-navy)" : "var(--border)"}`,
                    borderRadius: "var(--radius-lg)",
                    padding: "22px 24px",
                    textAlign: "left",
                    cursor: state === "voting" ? "pointer" : "default",
                    opacity: isDimmed ? 0.3 : 1,
                    transform: isChosen ? "scale(1.01)" : "scale(1)",
                    transition: "none",
                    display: "flex", alignItems: "center", gap: 18,
                    boxShadow: isChosen ? "0 4px 20px rgba(26,58,92,0.2)" : "var(--shadow)",
                  }}
                  onMouseEnter={e => {
                    if (state !== "voting" || chosen) return;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bg-navy)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(26,58,92,0.12)";
                  }}
                  onMouseLeave={e => {
                    if (state !== "voting" || isChosen) return;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow)";
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: "var(--radius)", flexShrink: 0,
                    background: isChosen ? "rgba(255,255,255,0.15)" : "var(--bg-steel)",
                    border: `1.5px solid ${isChosen ? "rgba(255,255,255,0.3)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                    color: isChosen ? "white" : "var(--bg-navy)",
                    transition: "none",
                  }}>
                    {side.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: isChosen ? "white" : "var(--text)", lineHeight: 1.3, marginBottom: item?.problem || item?.description ? 4 : 0 }}>
                      {item?.title}
                    </div>
                    {item?.problem && (
                      <div style={{ fontSize: 12, color: isChosen ? "rgba(255,255,255,0.6)" : "var(--text-muted)", lineHeight: 1.45, marginBottom: item?.description ? 4 : 0, fontStyle: "italic" }}>
                        {item.problem}
                      </div>
                    )}
                    {item?.description && (
                      <div style={{ fontSize: 13, color: isChosen ? "rgba(255,255,255,0.7)" : "var(--text-secondary)", lineHeight: 1.5 }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12, marginTop: 24 }}>
            {total - done} Vergleiche verbleibend · tippen Sie auf den, der strategisch vielversprechender wirkt
          </p>
        </div>
      </div>
    </div>
  );
}
