import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

const STORAGE_KEY = "elo_rater_session";

export default function JoinPage() {
  const [step, setStep] = useState<"code" | "name">("code");
  const [roomCode, setRoomCode] = useState("");
  const [roomInfo, setRoomInfo] = useState<{ title: string; innovation_count: number } | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const code = params.get("room");
    if (code) {
      // Room link takes priority — always join the linked session, don't resume old token
      const cleaned = code.replace(/\s/g, "").toUpperCase();
      setRoomCode(cleaned);
      setLoading(true);
      api.checkRoom(cleaned)
        .then(info => { setRoomInfo(info); setStep("name"); })
        .catch((err: any) => { setError(err.message || "Sitzung nicht gefunden. Überprüfen Sie den Code und versuchen Sie es erneut."); })
        .finally(() => setLoading(false));
      return;
    }
    // No room param — resume previous session from localStorage if available
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { token } = JSON.parse(stored);
        if (token) navigate(`/vote/${token}`);
      } catch {}
    }
  }, []);

  const handleCheckRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const info = await api.checkRoom(roomCode.replace(/\s/g, ""));
      setRoomInfo(info); setStep("name");
    } catch (err: any) {
      setError(err.message || "Sitzung nicht gefunden. Überprüfen Sie den Code und versuchen Sie es erneut.");
    } finally { setLoading(false); }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.joinSession(roomCode.replace(/\s/g, ""), name.trim());
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: res.token, name: res.rater_name, roomCode }));
      navigate(`/vote/${res.token}`);
    } catch (err: any) {
      setError(err.message || "Es ist etwas schiefgelaufen.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Top bar */}
      <div className="topbar">
        <div className="hy-logo">
          <div className="hy-logo-mark">hy</div>
          <span className="hy-logo-text">Opportunity - Ranker</span>
        </div>
        <a href="/admin" style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
          Admin →
        </a>
      </div>

      {/* Hero band */}
      <div style={{ background: "var(--bg-navy)", padding: "48px 24px 52px", textAlign: "center" }}>
        <h1 style={{ color: "white", fontSize: 28, marginBottom: 10, fontFamily: "var(--font-display)" }}>
          {step === "code" ? "Rank the Opportunities" : roomInfo?.title}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, maxWidth: 420, margin: "0 auto" }}>
          {step === "code"
            ? "Geben Sie Ihren Sitzungscode ein, um die paarweise Ranking-Übung zu beginnen"
            : `${roomInfo?.innovation_count} Opportunities · dauert etwa 5 Minuten`}
        </p>
      </div>

      {/* Card */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 420 }} className="fade-up">

          {step === "code" && (
            <form onSubmit={handleCheckRoom} className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label className="label">Sitzungscode</label>
                <input
                  autoFocus
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="z.B. 847291"
                  maxLength={8}
                  style={{ fontSize: 32, fontFamily: "var(--font-body)", letterSpacing: "0.2em", textAlign: "center", fontWeight: 700 }}
                />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading || roomCode.length < 4} style={{ marginTop: 4, width: "100%" }}>
                {loading ? "Wird geprüft…" : "Weiter →"}
              </button>
            </form>
          )}

          {step === "name" && (
            <form onSubmit={handleJoin} className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ padding: "12px 16px", background: "var(--accent-bg)", border: "1px solid var(--accent)", borderRadius: "var(--radius)", marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 2 }}>Sitzung</div>
                <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 15 }}>{roomInfo?.title}</div>
              </div>
              <div>
                <label className="label">Dein Name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Wie sollen wir dich nennen?"
                  maxLength={40}
                />
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn-accent" type="submit" disabled={loading || name.trim().length < 2} style={{ width: "100%" }}>
                {loading ? "Wird beigetreten…" : "Ranking starten →"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => { setStep("code"); setError(""); setRoomInfo(null); }} style={{ width: "100%" }}>
                ← Zurück
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
