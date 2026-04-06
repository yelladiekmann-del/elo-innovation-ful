import { useState } from "react";
import { ALL_OPPORTUNITIES, type Opportunity } from "../lib/opportunities";

// ── Scoring helpers ────────────────────────────────────────────────────────────
function sliderSide(value: number): "left" | "right" | "neutral" {
  if (value <= 4) return "left";
  if (value >= 6) return "right";
  return "neutral";
}

function scoreOpportunity(opp: Opportunity, sliders: Record<string, number>): number {
  let score = 0;
  for (const cls of opp.classifications) {
    const userSide = sliderSide(sliders[`q${cls.question_id}`]);
    if (userSide === "neutral" || cls.alignment === "neutral") continue;
    score += userSide === cls.alignment ? 1 : -1;
  }
  return score;
}

// ── Questions ─────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "q1",
    title: "Wollen wir eine hochprofitable Boutique für Wenige sein oder eine relevante Volumenbank?",
    left: "Boutique für Wenige",
    right: "Relevante Volumenbank",
    leftDetail: "Die Bank der Zukunft wird maßgeblich von den Erträgen aus Private Banking und Firmenkundengeschäft stehen: Wir priorisieren entsprechend klar unsere Projekte und Ressourcen, um diese Bereiche zu stärken",
    rightDetail: "Die Bank der Zukunft wird über die Effizienz und Breite der Plattform gewonnen: Wir priorisieren unsere Ressourcen radikal auf die Standardisierung und Automatisierung unseres Massengeschäfts, um über Skaleneffekte und Marktpräsenz wettbewerbsfähig zu bleiben",
  },
  {
    id: "q2",
    title: "Wollen wir eine stabilitätsorientierte Linienorganisation bleiben oder eine umsetzungsorientierte Lieferorganisation werden?",
    left: "Linienorganisation",
    right: "Lieferorganisation",
    leftDetail: "Unsere Zukunftsfähigkeit basiert auf maximaler Stabilität und regulatorischer Sicherheit",
    rightDetail: "Unsere Zukunftsfähigkeit entscheidet sich nicht am Konzept, sondern an der Time-to-Market. Wir müssen die Trennung von Vertrieb und Betrieb überwinden und Ressourcen konsequent in bereichsübergreifende Umsetzungsteams investieren, um PS-Verluste an den Schnittstellen zu stoppen.",
  },
  {
    id: "q3",
    title: "Wollen wir ein passiver Verbundpartner mit fragmentierter IT sein oder ein datenfähiger Marktgestalter mit eigener technologischer Geschwindigkeit?",
    left: "Passiver Verbundpartner",
    right: "Datenfähiger Marktgestalter",
    leftDetail: "Wir verzichten bewusst auf teure Eigenentwicklungen, Partnerschaften und individuelle Datenstrukturen, um von den Skaleneffekten des Verbunds zu profitieren. Wir priorisieren unsere Ressourcen auf die nahtlose Integration der Verbundstandards, minimieren unsere IT-Komplexität und akzeptieren die technologische Roadmap des Verbunds",
    rightDetail: "Wachstum und KI-Fähigkeit basieren auf verfügbaren Daten. Wir müssen unsere technologische Abhängigkeit reduzieren und Ressourcen in eine eigene, konsolidierte Datenstruktur investieren, um die Handbremse des Verbunds zu lösen und die Steuerungshoheit zurückzugewinnen",
  },
  {
    id: "q4",
    title: "Wollen wir lieber der Kundenkontaktpunkt ohne Finanzleistung sein oder die Finanzleistung ohne Kundenkontakt?",
    left: "Kundenkontaktpunkt",
    right: "Finanzleistung im Ökosystem",
    leftDetail: "Wir priorisieren die Kundenschnittstelle. Unsere Zukunftsfähigkeit liegt im Vertrauen und der Beratung. Wir investieren in die Sichtbarkeit, auch wenn wir im Hintergrund Fremdprodukte integrieren, um für den Kunden relevant zu bleiben",
    rightDetail: "Wenn Finanzdienstleistungen unsichtbar in den Alltag der Kunden verschwinden, verliert unsere Marke ihre Relevanz. Wir müssen unsere Ressourcen darauf fokussieren, uns nahtlos in diese neuen Ökosysteme zu integrieren, statt darauf zu warten, dass der Kunde zu uns kommt. Wir investieren in Schnittstellen und Partnerschaften, um dort präsent zu sein, wo die Entscheidung fällt.",
  },
  {
    id: "q5",
    title: "Wollen wir ein traditioneller Bankbetrieb mit modernen Tools bleiben oder eine digitale Leistungskultur entwickeln, die Technik konsequent nutzt?",
    left: "Technische Leitplanken",
    right: "Digitale Leistungskultur",
    leftDetail: "Wir begegnen dem Mindset-Stau durch technische Leitplanken. Wir investieren in eine Architektur, die den Prozess strikt vorgebt. Wir priorisieren die System-Disziplin, um individuelle Fehlerquellen zu minimieren und eine industriell effiziente Abwicklung technisch zu erzwingen",
    rightDetail: "Wir überwinden die Kluft durch radikale Befähigung. Wir investieren massiv in das Upskilling unserer Leute, damit Technik als Hebel für exzellente Beratung verstanden wird. Wir priorisieren das Mindset, um eine Organisation zu schaffen, die digital denkt und eigenverantwortlich handelt",
  },
];

type Step = "setup" | "questions" | "results" | "done";

export default function FilterApp() {
  const [step, setStep] = useState<Step>("setup");
  const [sliders, setSliders] = useState<Record<string, number>>({ q1: 5, q2: 5, q3: 5, q4: 5, q5: 5 });
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  // Results
  const [selectedOpps, setSelectedOpps] = useState<Opportunity[]>([]);
  const [remainingOpps, setRemainingOpps] = useState<Opportunity[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  // Done — ELO session creation
  const [sessionTitle, setSessionTitle] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [eloLoading, setEloLoading] = useState(false);
  const [eloError, setEloError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Filter ───────────────────────────────────────────────────────────────────
  const handleFilter = () => {
    const scored = ALL_OPPORTUNITIES.map(opp => ({
      opp,
      score: scoreOpportunity(opp, sliders),
    }));
    scored.sort(() => Math.random() - 0.5);
    scored.sort((a, b) => b.score - a.score);
    const top20 = scored.slice(0, 20).map(s => s.opp);
    const top20Ids = new Set(top20.map(o => o.id));
    setSelectedOpps(top20);
    setRemainingOpps(ALL_OPPORTUNITIES.filter(o => !top20Ids.has(o.id)));
    setStep("results");
  };

  // ── Add / Remove ─────────────────────────────────────────────────────────────
  const removeOpp = (id: string) => {
    const opp = selectedOpps.find(o => o.id === id)!;
    setSelectedOpps(prev => prev.filter(o => o.id !== id));
    setRemainingOpps(prev => [...prev, opp].sort((a, b) => a.id.localeCompare(b.id)));
  };

  const addOpp = (opp: Opportunity) => {
    setRemainingOpps(prev => prev.filter(o => o.id !== opp.id));
    setSelectedOpps(prev => [...prev, opp]);
  };

  const filteredRemaining = remainingOpps.filter(o =>
    !addSearch || o.title.toLowerCase().includes(addSearch.toLowerCase())
  );

  // ── ELO session creation ─────────────────────────────────────────────────────
  const ELO_API = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

  const handleStartRanking = async () => {
    setEloLoading(true);
    setEloError(null);
    try {
      const res = await fetch(`${ELO_API}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessionTitle,
          admin_password: adminPassword,
          innovations: selectedOpps.map(o => ({ id: o.id, title: o.title, description: o.description })),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setRoomCode(data.room_code);
      setStep("done");
    } catch {
      setEloError("Session konnte nicht erstellt werden. Bitte erneut versuchen.");
    } finally {
      setEloLoading(false);
    }
  };

  const resetAll = () => {
    setStep("setup");
    setSliders({ q1: 5, q2: 5, q3: 5, q4: 5, q5: 5 });
    setExpandedQ(null);
    setSelectedOpps([]);
    setRemainingOpps([]);
    setShowAddPanel(false);
    setAddSearch("");
    setSessionTitle("");
    setAdminPassword("");
    setEloError(null);
    setRoomCode(null);
    setLinkCopied(false);
  };

  const shareLink = roomCode ? `${window.location.origin}/?room=${roomCode}` : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const sliderLabel = (id: string) => {
    const v = sliders[id];
    const q = QUESTIONS.find(q => q.id === id)!;
    if (v === 5) return "Neutral";
    if (v <= 2) return `Stark: ${q.left}`;
    if (v <= 4) return `Eher: ${q.left}`;
    if (v >= 8) return `Stark: ${q.right}`;
    return `Eher: ${q.right}`;
  };

  // ── STEP 0: SETUP ────────────────────────────────────────────────────────────
  if (step === "setup") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="hy-logo">
          <div className="hy-logo-mark">hy</div>
          <span className="hy-logo-text">Opportunity Filter</span>
        </div>
      </div>

      <div style={{ background: "var(--bg-navy)", padding: "40px 24px 44px", textAlign: "center" }}>
        <h1 style={{ color: "white", fontSize: 26, marginBottom: 10 }}>Ranking-Session einrichten</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, maxWidth: 460, margin: "0 auto" }}>
          Legen Sie zuerst einen Namen und ein Passwort für die Session fest. Danach wählen Sie gemeinsam die strategische Ausrichtung.
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 480 }} className="fade-up">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 16 }}>Session-Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
                  Session-Titel
                </label>
                <input
                  type="text"
                  placeholder="z.B. Strategieworkshop April 2026"
                  value={sessionTitle}
                  onChange={e => setSessionTitle(e.target.value)}
                  style={{ fontSize: 13, width: "100%", boxSizing: "border-box" }}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
                  Admin-Passwort
                </label>
                <input
                  type="password"
                  placeholder="Zum späteren Abruf der Ergebnisse"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && sessionTitle.trim() && adminPassword.trim()) setStep("questions"); }}
                  style={{ fontSize: 13, width: "100%", boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>
          <button
            className="btn-accent"
            onClick={() => setStep("questions")}
            disabled={!sessionTitle.trim() || !adminPassword.trim()}
            style={{ width: "100%", fontSize: 15, padding: "16px 28px" }}
          >
            Weiter zur strategischen Ausrichtung →
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP 1: FRAGEN ───────────────────────────────────────────────────────────
  if (step === "questions") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="hy-logo">
          <div className="hy-logo-mark">hy</div>
          <span className="hy-logo-text">Opportunity Filter</span>
        </div>
        <button className="btn-ghost-white" onClick={() => setStep("setup")}>← Zurück</button>
      </div>

      <div style={{ background: "var(--bg-navy)", padding: "40px 24px 44px", textAlign: "center" }}>
        <h1 style={{ color: "white", fontSize: 26, marginBottom: 10 }}>Strategische Ausrichtung</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, maxWidth: 520, margin: "0 auto" }}>
          Beantworten Sie die folgenden 5 Fragen. Basierend auf Ihrer Einschätzung werden die relevantesten Opportunities aus {ALL_OPPORTUNITIES.length} Möglichkeiten ausgewählt.
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "32px 24px 56px" }}>
        <div style={{ width: "100%", maxWidth: 700 }}>
          {QUESTIONS.map((q, idx) => (
            <div key={q.id} className="card fade-up" style={{ marginBottom: 18, padding: 0, overflow: "hidden", animationDelay: `${idx * 50}ms` }}>

              {/* Header */}
              <div style={{ padding: "22px 24px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", background: "var(--bg-navy)",
                    color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
                  }}>{idx + 1}</span>
                  <h3 style={{ fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 700, lineHeight: 1.5, color: "var(--text)" }}>
                    {q.title}
                  </h3>
                </div>

                {/* Slider */}
                <div style={{ padding: "0 2px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sliders[q.id] <= 4 ? "var(--bg-navy)" : "var(--text-muted)", flex: 1, transition: "color 200ms ease" }}>
                      {q.left}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sliders[q.id] >= 6 ? "var(--bg-navy)" : "var(--text-muted)", flex: 1, textAlign: "right", transition: "color 200ms ease" }}>
                      {q.right}
                    </span>
                  </div>

                  {/* Track + thumb */}
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                      <div style={{
                        height: "100%", borderRadius: 2, background: "var(--bg-navy)",
                        width: `${((sliders[q.id] - 1) / 8) * 100}%`,
                        transition: "width 100ms ease",
                      }} />
                    </div>
                    <input
                      type="range" min={1} max={9} step={1}
                      value={sliders[q.id]}
                      onChange={e => setSliders(prev => ({ ...prev, [q.id]: Number(e.target.value) }))}
                      style={{ position: "absolute", top: -9, left: 0, width: "100%", height: 22, opacity: 0, cursor: "pointer", margin: 0, padding: 0 }}
                    />
                    <div style={{
                      position: "absolute",
                      top: -9,
                      left: `calc(${((sliders[q.id] - 1) / 8) * 100}% - 11px)`,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "var(--bg-navy)", border: "3px solid white",
                      boxShadow: "0 1px 6px rgba(26,58,92,0.35)",
                      pointerEvents: "none",
                      transition: "left 100ms ease",
                    }} />
                  </div>

                  {/* Tick dots */}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "0 1px" }}>
                    {[1,2,3,4,5,6,7,8,9].map(v => (
                      <div
                        key={v}
                        onClick={() => setSliders(prev => ({ ...prev, [q.id]: v }))}
                        style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: v <= sliders[q.id] ? "var(--bg-navy)" : "var(--border)",
                          cursor: "pointer", transition: "background 100ms ease",
                        }}
                      />
                    ))}
                  </div>

                  {/* Label */}
                  <div style={{ textAlign: "center", marginTop: 12 }}>
                    <span style={{
                      display: "inline-block", padding: "3px 14px",
                      background: "var(--accent-bg)", border: "1px solid var(--accent)",
                      borderRadius: "var(--radius-pill)", fontSize: 11, fontWeight: 700,
                      color: "var(--accent-dark)", letterSpacing: "0.04em",
                    }}>
                      {sliderLabel(q.id)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expand toggle */}
              <div
                onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                style={{ borderTop: "1px solid var(--border-light)", padding: "9px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", userSelect: "none" }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                  {expandedQ === q.id ? "Beschreibung ausblenden" : "Beschreibung anzeigen"}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 14, transform: expandedQ === q.id ? "rotate(180deg)" : "none", transition: "transform 200ms ease", display: "inline-block" }}>▾</span>
              </div>

              {/* Detail */}
              {expandedQ === q.id && (
                <div style={{ padding: "0 24px 20px", background: "var(--bg)" }} className="fade-in">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                    {[{ label: q.left, text: q.leftDetail }, { label: q.right, text: q.rightDetail }].map(side => (
                      <div key={side.label} style={{ padding: "12px 14px", background: "white", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--bg-navy)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{side.label}</div>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{side.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            className="btn-accent"
            onClick={handleFilter}
            style={{ width: "100%", fontSize: 15, padding: "16px 28px", marginTop: 8 }}
          >
            {ALL_OPPORTUNITIES.length} Opportunities filtern →
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP 2: ERGEBNISSE ───────────────────────────────────────────────────────
  if (step === "results") return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="hy-logo">
          <div className="hy-logo-mark">hy</div>
          <span className="hy-logo-text">Opportunity Filter</span>
        </div>
        <button className="btn-ghost-white" onClick={resetAll}>
          ← Neu starten
        </button>
      </div>

      <div style={{ background: "var(--bg-navy)", padding: "28px 24px 32px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <h1 style={{ color: "white", fontSize: 22, marginBottom: 6 }}>Ausgewählte Opportunities</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
            Basierend auf Ihrer strategischen Ausrichtung. Passen Sie die Auswahl manuell an bevor Sie das Ranking starten.
          </p>
        </div>
      </div>

      <div style={{ flex: 1, padding: "24px 24px 56px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 860 }}>

          {/* Status bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: eloError ? 8 : 20, padding: "12px 18px",
            background: "white", borderRadius: "var(--radius-lg)",
            border: `1.5px solid ${selectedOpps.length === 20 ? "var(--accent)" : selectedOpps.length > 20 ? "var(--danger)" : "var(--border)"}`,
            boxShadow: "var(--shadow)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                padding: "4px 14px", borderRadius: "var(--radius-pill)", fontWeight: 700, fontSize: 14,
                background: selectedOpps.length === 20 ? "var(--accent-bg)" : selectedOpps.length > 20 ? "rgba(217,79,79,0.1)" : "var(--bg-steel)",
                color: selectedOpps.length === 20 ? "var(--accent-dark)" : selectedOpps.length > 20 ? "var(--danger)" : "var(--text-secondary)",
                border: `1px solid ${selectedOpps.length === 20 ? "var(--accent)" : selectedOpps.length > 20 ? "var(--danger)" : "var(--border)"}`,
              }}>
                {selectedOpps.length} / 20 ausgewählt
              </span>
              {selectedOpps.length !== 20 && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {selectedOpps.length < 20 ? `Noch ${20 - selectedOpps.length} hinzufügen` : `${selectedOpps.length - 20} entfernen`}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={() => { setShowAddPanel(v => !v); setAddSearch(""); }} style={{ fontSize: 13 }}>
                {showAddPanel ? "Panel schließen" : "+ Opportunity hinzufügen"}
              </button>
              <button
                className="btn-primary"
                onClick={handleStartRanking}
                disabled={selectedOpps.length === 0 || eloLoading}
                style={{ fontSize: 13 }}
              >
                {eloLoading ? "Wird erstellt…" : "Ranking starten →"}
              </button>
            </div>
          </div>
          {eloError && (
            <div className="error-msg" style={{ marginBottom: 16 }}>{eloError}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: showAddPanel ? "1fr 320px" : "1fr", gap: 20, alignItems: "start" }}>

            {/* Selected grid */}
            <div>
              <div className="label" style={{ marginBottom: 12 }}>Ausgewählte Opportunities ({selectedOpps.length})</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {selectedOpps.map((opp, i) => (
                  <div key={opp.id} className="fade-up" style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "12px 14px", background: "white",
                    border: "1.5px solid var(--border)", borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow)", animationDelay: `${Math.min(i * 15, 300)}ms`,
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%", background: "var(--bg-navy)",
                      color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text)", lineHeight: 1.35 }}>{opp.title}</div>
                    </div>
                    <button
                      onClick={() => removeOpp(opp.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 17, lineHeight: 1, padding: "0 2px", cursor: "pointer", flexShrink: 0 }}
                      title="Entfernen"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add panel */}
            {showAddPanel && (
              <div style={{ position: "sticky", top: 74 }} className="fade-in">
                <div className="label" style={{ marginBottom: 12 }}>Weitere Opportunities ({remainingOpps.length})</div>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                    <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Suchen…" style={{ fontSize: 13 }} />
                  </div>
                  <div style={{ maxHeight: 500, overflowY: "auto" }}>
                    {filteredRemaining.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Keine weiteren Opportunities</div>
                    )}
                    {filteredRemaining.map(opp => (
                      <div
                        key={opp.id}
                        onClick={() => addOpp(opp)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "var(--bg)"}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>{opp.title}</div>
                        </div>
                        <span style={{ color: "var(--bg-navy)", fontSize: 18, fontWeight: 700, flexShrink: 0, lineHeight: 1.2 }}>+</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 3: FERTIG ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div className="topbar">
        <div className="hy-logo">
          <div className="hy-logo-mark">hy</div>
          <span className="hy-logo-text">Opportunity Filter</span>
        </div>
        <button className="btn-ghost-white" onClick={resetAll}>← Neue Sitzung</button>
      </div>

      <div style={{ background: "var(--bg-navy)", padding: "40px 24px 44px", textAlign: "center" }}>
        <h1 style={{ color: "white", fontSize: 26, marginBottom: 8 }}>Ranking-Session bereit!</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
          {selectedOpps.length} Opportunities sind im Ranker verfügbar
        </p>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 520 }} className="fade-up">

          <div className="card" style={{ textAlign: "center", marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 8 }}>Room Code</div>
            <div style={{ fontSize: 52, fontFamily: "var(--font-body)", fontWeight: 800, letterSpacing: "0.25em", color: "var(--bg-navy)", margin: "6px 0 4px" }}>
              {roomCode}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 10 }}>Teilnehmer-Link</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={shareLink}
                onClick={e => (e.target as HTMLInputElement).select()}
                style={{ flex: 1, fontSize: 13, fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: "var(--bg)", cursor: "text" }}
              />
              <button
                className={linkCopied ? "btn-primary" : "btn-accent"}
                onClick={handleCopyLink}
                style={{ whiteSpace: "nowrap", fontSize: 13, padding: "0 16px" }}
              >
                {linkCopied ? "Kopiert ✓" : "Link kopieren"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              Teilnehmer öffnen diesen Link und müssen nur noch ihren Namen eingeben.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <a
              href="/admin"
              className="btn-primary"
              style={{ flex: 1, textAlign: "center", fontSize: 13, textDecoration: "none" }}
            >
              Admin-Dashboard öffnen →
            </a>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" onClick={() => setStep("results")} style={{ flex: 1 }}>← Opportunities anpassen</button>
            <button className="btn-accent" onClick={resetAll} style={{ flex: 1 }}>Neue Sitzung</button>
          </div>
        </div>
      </div>
    </div>
  );
}
