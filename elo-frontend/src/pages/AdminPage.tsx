import { useState, useEffect } from "react";
import { api } from "../lib/api";

const ADMIN_STORAGE_KEY = "elo_admin_session";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ErrorBar } from "recharts";

type AdminView = "list" | "auth" | "dashboard";
interface SessionListItem { room_code: string; title: string; innovation_count: number; created_at: string; is_active: boolean; }
interface SessionDashboard { session_title: string; total_raters: number; raters_with_votes: number; aggregate_rankings: any[]; individual_rankings: any[]; }
interface SessionInfo { room_code: string; title: string; innovation_count: number; raters: any[]; }

export default function AdminPage() {
  const [view, setView] = useState<AdminView>("list");
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<SessionDashboard | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"aggregate" | "individual" | "raters">("aggregate");

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionListItem | null>(null);

  const fetchSessions = () => {
    setSessionsLoading(true);
    api.listSessions()
      .then(data => setSessions(data))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    fetchSessions();

    // Try to restore previous admin session
    const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!stored) return;
    try {
      const { roomCode: rc, password: pw } = JSON.parse(stored);
      if (!rc || !pw) return;
      setRoomCode(rc); setPassword(pw); setLoading(true);
      Promise.all([api.getSessionInfo(rc, pw), api.getAggregateRankings(rc, pw)])
        .then(([info, rankings]) => { setSessionInfo(info); setDashboard(rankings); setView("dashboard"); })
        .catch(() => localStorage.removeItem(ADMIN_STORAGE_KEY))
        .finally(() => setLoading(false));
    } catch { localStorage.removeItem(ADMIN_STORAGE_KEY); }
  }, []);

  const handleSelectSession = (s: SessionListItem) => {
    setSelectedSession(s);
    setRoomCode(s.room_code);
    setPassword("");
    setError("");
    setView("auth");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const [info, rankings] = await Promise.all([api.getSessionInfo(roomCode, password), api.getAggregateRankings(roomCode, password)]);
      setSessionInfo(info); setDashboard(rankings);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ roomCode, password }));
      setView("dashboard");
    } catch (err: any) { setError(err.message || "Falsches Passwort."); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setView("list"); setDashboard(null); setSessionInfo(null);
    setRoomCode(""); setPassword(""); setSelectedSession(null);
    fetchSessions();
  };

  const refreshDashboard = async () => {
    if (!roomCode || !password) return;
    setLoading(true);
    try {
      const [info, rankings] = await Promise.all([api.getSessionInfo(roomCode, password), api.getAggregateRankings(roomCode, password)]);
      setSessionInfo(info); setDashboard(rankings);
    } catch {} finally { setLoading(false); }
  };

  const NavBar = () => (
    <div className="topbar">
      <div className="hy-logo">
        <div className="hy-logo-mark">hy</div>
        <span className="hy-logo-text">Opportunity Ranker — Admin</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {view === "dashboard" && <button className="btn-ghost-white" onClick={refreshDashboard} disabled={loading}>{loading ? "…" : "↻ Aktualisieren"}</button>}
        {view === "dashboard" && <button className="btn-ghost-white" onClick={handleLogout}>← Alle Sitzungen</button>}
        {view === "auth" && <button className="btn-ghost-white" onClick={() => { setView("list"); setError(""); }}>← Zurück</button>}
      </div>
    </div>
  );

  // ── Sessions list ───────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />
      <div style={{ background: "var(--bg-navy)", padding: "48px 24px 52px", textAlign: "center" }}>
        <h1 style={{ color: "white", fontSize: 26, marginBottom: 8 }}>Admin-Panel</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Wählen Sie eine Sitzung aus oder erstellen Sie eine neue</p>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 520 }} className="fade-up">
          <a href="/filter" className="btn-accent" style={{ width: "100%", marginBottom: 24, fontSize: 14, padding: "14px 28px", display: "block", textAlign: "center", textDecoration: "none" }}>
            + Neue Sitzung erstellen
          </a>

          <div className="label" style={{ marginBottom: 12 }}>Vorhandene Sitzungen</div>

          {sessionsLoading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0", fontSize: 13 }}>Wird geladen…</div>
          ) : sessions.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 14 }}>
              Noch keine Sitzungen erstellt.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sessions.map(s => (
                <button
                  key={s.room_code}
                  onClick={() => handleSelectSession(s)}
                  style={{
                    background: "white", border: "1.5px solid var(--border)", borderRadius: "var(--radius-lg)",
                    padding: "16px 20px", textAlign: "left", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 16,
                    boxShadow: "var(--shadow)", transition: "all var(--transition)",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--bg-navy)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(26,58,92,0.12)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow)"; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13, letterSpacing: "0.15em",
                        color: "var(--bg-navy)", background: "var(--bg-steel)",
                        padding: "2px 10px", borderRadius: "var(--radius-pill)",
                      }}>{s.room_code}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.innovation_count} Opportunities</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(s.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 18, flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Auth ────────────────────────────────────────────────────────────────────
  if (view === "auth") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />
      <div style={{ background: "var(--bg-navy)", padding: "48px 24px 52px", textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
          Raum {selectedSession?.room_code}
        </div>
        <h1 style={{ color: "white", fontSize: 24, marginBottom: 8 }}>{selectedSession?.title}</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{selectedSession?.innovation_count} Opportunities</p>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 420 }} className="fade-up">
          <form onSubmit={handleLogin} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="label">Admin-Passwort</label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading || !password} style={{ width: "100%" }}>
              {loading ? "Wird geladen…" : "Dashboard öffnen →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const agg = dashboard?.aggregate_rankings || [];
  const chartData = agg.map(item => ({
    name: item.title.length > 22 ? item.title.slice(0, 22) + "…" : item.title,
    fullName: item.title,
    rating: Math.round(item.mean_rating),
    error: [Math.round(item.std_dev), Math.round(item.std_dev)],
    std: Math.round(item.std_dev),
  }));

  const tabStyle = (active: boolean) => ({
    padding: "8px 18px", borderRadius: "var(--radius-pill)",
    fontSize: 13, fontWeight: 600,
    background: active ? "var(--bg-navy)" : "transparent",
    border: `1.5px solid ${active ? "var(--bg-navy)" : "var(--border)"}`,
    color: active ? "white" : "var(--text-secondary)",
    cursor: "pointer", transition: "all var(--transition)",
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar />

      {/* Dashboard header */}
      <div style={{ background: "var(--bg-navy)", padding: "32px 32px 36px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
            Raum {sessionInfo?.room_code}
          </div>
          <h1 style={{ color: "white", fontSize: 24, marginBottom: 6 }}>{dashboard?.session_title}</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
            {dashboard?.raters_with_votes} von {dashboard?.total_raters} Teilnehmern haben Stimmen eingereicht
          </p>
        </div>
      </div>

      <div style={{ flex: 1, padding: "32px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {(["aggregate", "individual", "raters"] as const).map(tab => (
              <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                {tab === "aggregate" ? "Aggregierte Rankings" : tab === "individual" ? "Nach Teilnehmer" : "Fortschritt"}
              </button>
            ))}
          </div>

          {/* Aggregate */}
          {activeTab === "aggregate" && (
            <div className="fade-up">
              {agg.length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 56 }}>
                  Noch keine Stimmen. Teilen Sie den Raumcode <strong style={{ color: "var(--bg-navy)" }}>{sessionInfo?.room_code}</strong> mit Ihrem Team.
                </div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: 20, padding: "24px 8px 16px" }}>
                    <div className="label" style={{ paddingLeft: 16, marginBottom: 16 }}>Durchschn. Elo-Bewertung (± Standardabw.)</div>
                    <ResponsiveContainer width="100%" height={Math.max(280, agg.length * 36)}>
                      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
                        <XAxis type="number" domain={['dataMin - 30', 'dataMax + 30']} tick={{ fontSize: 11, fill: "#7a96b0" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#122840", fontFamily: "Inter" }} width={170} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(26,58,92,0.04)" }}
                          contentStyle={{ background: "white", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}
                          formatter={(val: any, _name: any, props: any) => [`${val} ± ${props.payload.std}`, "Elo rating"]}
                          labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                        />
                        <Bar dataKey="rating" radius={[0, 4, 4, 0]} maxBarSize={24}>
                          {chartData.map((_, index) => (
                            <Cell key={index} fill={index === 0 ? "#f0b429" : index < 3 ? "#1a3a5c" : "#d0dce8"} />
                          ))}
                          <ErrorBar dataKey="error" width={4} strokeWidth={1.5} stroke="#7a96b0" direction="x" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1.5px solid var(--border)", background: "var(--bg)" }}>
                          {["#", "Gelegenheit", "Ø Bewertung", "Std.Abw.", "Bewerter"].map(h => (
                            <th key={h} style={{ padding: "10px 16px", textAlign: h === "#" ? "center" : "left", color: "var(--text-muted)", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agg.map((item, i) => (
                          <tr key={item.id} style={{ borderBottom: i < agg.length - 1 ? "1px solid var(--border-light)" : "none", background: i === 0 ? "var(--accent-bg)" : "white" }}>
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <span style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: i === 0 ? "var(--accent)" : i < 3 ? "var(--bg-navy)" : "var(--bg-steel)", color: i === 0 ? "var(--text)" : i < 3 ? "white" : "var(--text-muted)" }}>
                                {i + 1}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: i < 3 ? 600 : 400, color: "var(--text)" }}>{item.title}</div>
                              {item.description && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.description}</div>}
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: i < 3 ? "var(--bg-navy)" : "var(--text-secondary)" }}>{Math.round(item.mean_rating)}</td>
                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>±{Math.round(item.std_dev)}</td>
                            <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{item.num_raters}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Individual */}
          {activeTab === "individual" && (
            <div className="fade-up">
              {(dashboard?.individual_rankings || []).length === 0 ? (
                <div className="card" style={{ textAlign: "center", color: "var(--text-muted)", padding: 56 }}>Noch keine Stimmen.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {(dashboard?.individual_rankings || []).map((rater: any) => (
                    <div key={rater.rater_name} className="card" style={{ padding: 0, overflow: "hidden" }}>
                      <div style={{ padding: "14px 16px", borderBottom: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-navy)" }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--text)" }}>
                          {rater.rater_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "white" }}>{rater.rater_name}</span>
                      </div>
                      {rater.rankings.slice(0, 5).map((item: any, i: number) => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderBottom: i < 4 ? "1px solid var(--border-light)" : "none", background: i === 0 ? "var(--accent-bg)" : "white" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? "var(--accent-dark)" : "var(--text-muted)", minWidth: 18 }}>{i + 1}</span>
                          <span style={{ fontSize: 13, flex: 1, color: i < 3 ? "var(--text)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: i < 3 ? 500 : 400 }}>{item.title}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{Math.round(item.rating)}</span>
                        </div>
                      ))}
                      {rater.rankings.length > 5 && <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--text-muted)", background: "var(--bg)" }}>+{rater.rankings.length - 5} weitere</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Raters */}
          {activeTab === "raters" && (
            <div className="fade-up">
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {(sessionInfo?.raters || []).length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 56, fontSize: 14 }}>Noch keine Teilnehmer.</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid var(--border)", background: "var(--bg)" }}>
                        {["Teilnehmer", "Fortschritt", "Vergleiche", "Status"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-muted)", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(sessionInfo?.raters || []).map((rater: any, i: number) => (
                        <tr key={rater.id} style={{ borderBottom: i < (sessionInfo?.raters?.length || 0) - 1 ? "1px solid var(--border-light)" : "none" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>{rater.name}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div className="progress-track" style={{ width: 80 }}>
                                <div className="progress-fill" style={{ width: `${rater.percent}%` }} />
                              </div>
                              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{Math.round(rater.percent)}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{rater.completed_pairs} / {rater.total_pairs}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: rater.is_complete ? "rgba(46,158,107,0.12)" : "var(--bg-steel)", color: rater.is_complete ? "var(--success)" : "var(--text-muted)", border: `1px solid ${rater.is_complete ? "rgba(46,158,107,0.3)" : "var(--border)"}`, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              {rater.is_complete ? "Fertig" : "In Bearbeitung"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
