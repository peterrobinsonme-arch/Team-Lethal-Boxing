import { useState, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

const STORAGE_KEYS = { CLASSES: "lethal_classes", SIGNUPS: "lethal_signups", PIN: "lethal_pin", WAITLIST: "lethal_waitlist" };
const DEFAULT_PIN = "1234";

function loadData(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function formatPhone(val) {
  const digits = val.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
}
function formatDateTime(dateStr, timeStr) {
  const date = new Date(`${dateStr}T${timeStr}`);
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const inputStyle = {
  background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8,
  color: "#fff", padding: "9px 12px", fontSize: 13, outline: "none",
  width: "100%", boxSizing: "border-box", fontFamily: "inherit"
};
const pageStyle = { minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Inter', sans-serif", color: "#fff" };

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ count, max }) {
  const pct = max > 0 ? count / max : 0;
  const color = pct >= 1 ? "#ff3b3b" : pct >= 0.75 ? "#ff9500" : "#39ff14";
  return (
    <span style={{ background: color, color: "#000", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 800, letterSpacing: 1, whiteSpace: "nowrap" }}>
      {count}/{max} SPOTS
    </span>
  );
}

// ── Export roster to CSV ──────────────────────────────────────────────────────
function exportRoster(cls, enrolled, waitlist) {
  const rows = [["Type", "Name", "Phone"]];
  enrolled.forEach(s => rows.push(["Enrolled", s.name, s.phone]));
  waitlist.forEach(s => rows.push(["Waitlist", s.name, s.phone]));
  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cls.title.replace(/\s+/g, "_")}_roster.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Class Card ────────────────────────────────────────────────────────────────
function ClassCard({ cls, signups, waitlists, onSignup, onWaitlist, isCoach, onDelete, onRemoveStudent, onRemoveWaitlist, onPromoteWaitlist }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);
  const [waitSuccess, setWaitSuccess] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const enrolled = signups[cls.id] || [];
  const waitlist = waitlists[cls.id] || [];
  const full = enrolled.length >= cls.capacity;

  function handleSignup() {
    if (!name.trim()) return setErr("Name is required.");
    if (phone.replace(/\D/g, "").length < 10) return setErr("Enter a valid 10-digit phone number.");
    const ph = phone.replace(/\D/g, "");
    if (enrolled.find(s => s.phone.replace(/\D/g, "") === ph)) return setErr("This number is already signed up.");
    if (waitlist.find(s => s.phone.replace(/\D/g, "") === ph)) return setErr("This number is already on the waitlist.");
    if (full) {
      onWaitlist(cls.id, { name: name.trim(), phone });
      setWaitSuccess(true);
    } else {
      onSignup(cls.id, { name: name.trim(), phone });
      setSuccess(true);
    }
    setErr("");
  }

  return (
    <div style={{
      background: "linear-gradient(135deg, #1a1a1a 0%, #111 100%)",
      border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden",
      transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(57,255,20,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ background: "linear-gradient(90deg, #39ff14 0%, #00cc00 100%)", height: 4 }} />
      <div style={{ padding: "20px 24px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1.5 }}>{cls.title}</div>
            <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>🕐 {formatDateTime(cls.date, cls.time)} &nbsp;·&nbsp; {cls.duration} min</div>
            {cls.coach && <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>Coach: {cls.coach}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <Badge count={enrolled.length} max={cls.capacity} />
            {waitlist.length > 0 && (
              <span style={{ fontSize: 11, color: "#ff9500", fontWeight: 700 }}>⏳ {waitlist.length} on waitlist</span>
            )}
          </div>
        </div>

        {/* Description */}
        {cls.description && (
          <div style={{ marginTop: 12, color: "#777", fontSize: 13, lineHeight: 1.6, borderLeft: "2px solid #39ff14", paddingLeft: 12 }}>
            {cls.description}
          </div>
        )}

        {/* Coach roster */}
        {isCoach && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setExpanded(e => !e)} style={{
                background: "transparent", border: "1px solid #2a2a2a", color: "#888",
                borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", letterSpacing: 1
              }}>
                {expanded ? "▲ HIDE" : "▼ SHOW"} ROSTER ({enrolled.length})
              </button>
              <button onClick={() => exportRoster(cls, enrolled, waitlist)} style={{
                background: "transparent", border: "1px solid #2a2a2a", color: "#39ff14",
                borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", letterSpacing: 1
              }}>⬇ EXPORT CSV</button>
            </div>

            {expanded && (
              <div style={{ marginTop: 12 }}>
                {/* Enrolled */}
                <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>ENROLLED</div>
                {enrolled.length === 0 ? (
                  <div style={{ color: "#444", fontSize: 13, marginBottom: 12 }}>No students signed up yet.</div>
                ) : enrolled.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#aaa", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <div>
                      <span style={{ color: "#ddd" }}>{s.name}</span>
                      <span style={{ color: "#555", marginLeft: 12 }}>{s.phone}</span>
                    </div>
                    <button onClick={() => onRemoveStudent(cls.id, i)} style={{
                      background: "transparent", color: "#ff3b3b", border: "1px solid #331111",
                      borderRadius: 5, padding: "2px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600
                    }}>REMOVE</button>
                  </div>
                ))}

                {/* Waitlist */}
                {waitlist.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>WAITLIST</div>
                    {waitlist.map((s, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#aaa", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                        <div>
                          <span style={{ color: "#ff9500" }}>#{i+1}</span>
                          <span style={{ color: "#ddd", marginLeft: 8 }}>{s.name}</span>
                          <span style={{ color: "#555", marginLeft: 12 }}>{s.phone}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {!full && i === 0 && (
                            <button onClick={() => onPromoteWaitlist(cls.id)} style={{
                              background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid #39ff14",
                              borderRadius: 5, padding: "2px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600
                            }}>PROMOTE</button>
                          )}
                          <button onClick={() => onRemoveWaitlist(cls.id, i)} style={{
                            background: "transparent", color: "#ff3b3b", border: "1px solid #331111",
                            borderRadius: 5, padding: "2px 9px", fontSize: 11, cursor: "pointer", fontWeight: 600
                          }}>REMOVE</button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <button onClick={() => onDelete(cls.id)} style={{
              marginTop: 14, background: "transparent", color: "#ff3b3b", border: "1px solid #331111",
              borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600
            }}>Delete Class</button>
          </div>
        )}

        {/* Student signup */}
        {!isCoach && (
          <div style={{ marginTop: 14 }}>
            {success ? (
              <div style={{ background: "rgba(57,255,20,0.1)", border: "1px solid #39ff14", borderRadius: 8, padding: "10px 14px", color: "#39ff14", fontSize: 13, fontWeight: 600 }}>
                ✓ You&apos;re signed up! See you there.
              </div>
            ) : waitSuccess ? (
              <div style={{ background: "rgba(255,149,0,0.1)", border: "1px solid #ff9500", borderRadius: 8, padding: "10px 14px", color: "#ff9500", fontSize: 13, fontWeight: 600 }}>
                ⏳ You&apos;re on the waitlist! We&apos;ll let you know if a spot opens.
              </div>
            ) : (
              <>
                {full && (
                  <div style={{ fontSize: 12, color: "#ff9500", marginBottom: 8, fontWeight: 600 }}>
                    Class is full — you can join the waitlist below.
                  </div>
                )}
                <button onClick={() => setOpen(o => !o)} style={{
                  background: open ? "transparent" : full ? "linear-gradient(90deg, #ff9500, #e08000)" : "linear-gradient(90deg, #39ff14, #00cc00)",
                  color: open ? (full ? "#ff9500" : "#39ff14") : "#000",
                  border: open ? `1px solid ${full ? "#ff9500" : "#39ff14"}` : "none",
                  borderRadius: 8, padding: "8px 18px", fontWeight: 800, fontSize: 13,
                  cursor: "pointer", letterSpacing: 1, transition: "all 0.2s"
                }}>
                  {open ? "CANCEL" : full ? "JOIN WAITLIST" : "SIGN UP"}
                </button>
                {open && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                    <input placeholder="Phone number" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} style={inputStyle} />
                    {err && <div style={{ color: "#ff3b3b", fontSize: 12 }}>{err}</div>}
                    <button onClick={handleSignup} style={{
                      background: full ? "linear-gradient(90deg, #ff9500, #e08000)" : "linear-gradient(90deg, #39ff14, #00cc00)",
                      color: "#000", border: "none", borderRadius: 8, padding: "9px 0",
                      fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: 1
                    }}>{full ? "JOIN WAITLIST" : "CONFIRM SIGNUP"}</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PIN Gate ──────────────────────────────────────────────────────────────────
function PinGate({ onSuccess, onBack, currentPin }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  function checkPin(p) {
    if (p === currentPin) { onSuccess(); }
    else {
      setErr("Incorrect PIN. Try again.");
      setShake(true); setPin("");
      setTimeout(() => setShake(false), 500);
    }
  }
  function handleKey(k) {
    if (k === "⌫") { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) setTimeout(() => checkPin(next), 120);
  }

  return (
    <div style={pageStyle}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
      <div style={{ maxWidth: 380, margin: "0 auto", textAlign: "center", padding: "80px 16px 0" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#fff", letterSpacing: 3 }}>
          COACH <span style={{ color: "#39ff14" }}>PORTAL</span>
        </div>
        <div style={{ width: 40, height: 3, background: "#39ff14", margin: "16px auto 32px" }} />
        <div style={{ color: "#555", fontSize: 13, letterSpacing: 2, marginBottom: 20 }}>ENTER YOUR PIN</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, animation: shake ? "shake 0.4s ease" : "none" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 48, height: 56, background: "#111", border: `1px solid ${pin.length > i ? "#39ff14" : "#2a2a2a"}`,
              borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, color: "#39ff14", transition: "border-color 0.2s"
            }}>{pin.length > i ? "●" : ""}</div>
          ))}
        </div>
        {err && <div style={{ color: "#ff3b3b", fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 220, margin: "0 auto 24px" }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
            <button key={i} onClick={() => k !== "" && handleKey(String(k))} style={{
              background: k === "" ? "transparent" : "#1a1a1a",
              border: k === "" ? "none" : "1px solid #2a2a2a",
              color: "#fff", borderRadius: 10, padding: "14px 0",
              fontSize: 18, fontWeight: 700, cursor: k === "" ? "default" : "pointer", transition: "background 0.15s"
            }}
              onMouseEnter={e => { if (k !== "") e.currentTarget.style.background = "#252525"; }}
              onMouseLeave={e => { if (k !== "") e.currentTarget.style.background = "#1a1a1a"; }}
            >{k}</button>
          ))}
        </div>
        <button onClick={onBack} style={{
          background: "transparent", border: "1px solid #2a2a2a", color: "#555",
          borderRadius: 8, padding: "6px 18px", fontSize: 12, cursor: "pointer"
        }}>← Back</button>
      </div>
    </div>
  );
}

// ── Change PIN Modal ──────────────────────────────────────────────────────────
function ChangePinModal({ currentPin, onSave, onClose }) {
  const [step, setStep] = useState("current"); // current | new | confirm
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  const titles = { current: "Enter Current PIN", new: "Enter New PIN", confirm: "Confirm New PIN" };

  function handleKey(k) {
    if (k === "⌫") { setPin(p => p.slice(0, -1)); setErr(""); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (step === "current") {
          if (next === currentPin) { setStep("new"); setPin(""); setErr(""); }
          else { setErr("Incorrect PIN."); setShake(true); setPin(""); setTimeout(() => setShake(false), 500); }
        } else if (step === "new") {
          setNewPin(next); setStep("confirm"); setPin(""); setErr("");
        } else {
          if (next === newPin) { onSave(newPin); }
          else { setErr("PINs don't match. Try again."); setShake(true); setPin(""); setNewPin(""); setStep("new"); setTimeout(() => setShake(false), 500); }
        }
      }, 120);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: "36px 32px", textAlign: "center", minWidth: 300 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#fff", letterSpacing: 2, marginBottom: 4 }}>CHANGE PIN</div>
        <div style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>{titles[step]}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16, animation: shake ? "shake 0.4s ease" : "none" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 44, height: 52, background: "#0d0d0d", border: `1px solid ${pin.length > i ? "#39ff14" : "#2a2a2a"}`,
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, color: "#39ff14", transition: "border-color 0.2s"
            }}>{pin.length > i ? "●" : ""}</div>
          ))}
        </div>
        {err && <div style={{ color: "#ff3b3b", fontSize: 12, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 200, margin: "0 auto 20px" }}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
            <button key={i} onClick={() => k !== "" && handleKey(String(k))} style={{
              background: k === "" ? "transparent" : "#1a1a1a",
              border: k === "" ? "none" : "1px solid #2a2a2a",
              color: "#fff", borderRadius: 8, padding: "12px 0",
              fontSize: 16, fontWeight: 700, cursor: k === "" ? "default" : "pointer"
            }}
              onMouseEnter={e => { if (k !== "") e.currentTarget.style.background = "#252525"; }}
              onMouseLeave={e => { if (k !== "") e.currentTarget.style.background = "#1a1a1a"; }}
            >{k}</button>
          ))}
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "1px solid #2a2a2a", color: "#555",
          borderRadius: 8, padding: "6px 18px", fontSize: 12, cursor: "pointer"
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState(null);
  const [coachUnlocked, setCoachUnlocked] = useState(false);
  const [coachPin, setCoachPin] = useState(() => loadData(STORAGE_KEYS.PIN, DEFAULT_PIN));
  const [classes, setClasses] = useState(() => loadData(STORAGE_KEYS.CLASSES, []));
  const [signups, setSignups] = useState(() => loadData(STORAGE_KEYS.SIGNUPS, {}));
  const [waitlists, setWaitlists] = useState(() => loadData(STORAGE_KEYS.WAITLIST, {}));
  const [showForm, setShowForm] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [pinChanged, setPinChanged] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", duration: "60", capacity: "12", coach: "", description: "" });
  const [formErr, setFormErr] = useState("");

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes)); }, [classes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SIGNUPS, JSON.stringify(signups)); }, [signups]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(waitlists)); }, [waitlists]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PIN, JSON.stringify(coachPin)); }, [coachPin]);

  function createClass() {
    if (!form.title.trim() || !form.date || !form.time) return setFormErr("Title, date, and time are required.");
    const newCls = { id: Date.now().toString(), ...form, capacity: parseInt(form.capacity) || 12, duration: parseInt(form.duration) || 60 };
    setClasses(prev => [...prev, newCls]);
    setForm({ title: "", date: "", time: "", duration: "60", capacity: "12", coach: "", description: "" });
    setShowForm(false); setFormErr("");
  }
  function deleteClass(id) {
    setClasses(prev => prev.filter(c => c.id !== id));
    setSignups(prev => { const s = { ...prev }; delete s[id]; return s; });
    setWaitlists(prev => { const w = { ...prev }; delete w[id]; return w; });
  }
  function handleSignup(classId, student) {
    setSignups(prev => ({ ...prev, [classId]: [...(prev[classId] || []), student] }));
  }
  function handleWaitlist(classId, student) {
    setWaitlists(prev => ({ ...prev, [classId]: [...(prev[classId] || []), student] }));
  }
  function removeStudent(classId, idx) {
    setSignups(prev => ({ ...prev, [classId]: (prev[classId] || []).filter((_, i) => i !== idx) }));
  }
  function removeWaitlist(classId, idx) {
    setWaitlists(prev => ({ ...prev, [classId]: (prev[classId] || []).filter((_, i) => i !== idx) }));
  }
  function promoteWaitlist(classId) {
    const wait = waitlists[classId] || [];
    if (wait.length === 0) return;
    const [first, ...rest] = wait;
    setSignups(prev => ({ ...prev, [classId]: [...(prev[classId] || []), first] }));
    setWaitlists(prev => ({ ...prev, [classId]: rest }));
  }
  function handlePinSave(newPin) {
    setCoachPin(newPin);
    setShowPinChange(false);
    setPinChanged(true);
    setTimeout(() => setPinChanged(false), 3000);
  }

  const upcomingClasses = classes
    .filter(c => new Date(`${c.date}T${c.time}`) >= new Date())
    .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

  // ── Landing ──
  if (!mode) return (
    <div style={pageStyle}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 440, margin: "0 auto", textAlign: "center", padding: "80px 16px 0" }}>
        <div style={{ fontSize: 13, color: "#39ff14", letterSpacing: 4, fontWeight: 700, marginBottom: 16 }}>WELCOME TO</div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 72, color: "#fff", margin: 0, lineHeight: 0.9, letterSpacing: 3 }}>
          LETHAL<br /><span style={{ color: "#39ff14" }}>BOXING</span>
        </h1>
        <div style={{ width: 60, height: 3, background: "#39ff14", margin: "24px auto" }} />
        <p style={{ color: "#666", fontSize: 15, marginBottom: 48 }}>Select your role to continue.</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          {[["COACH", "coach", "🥊", "Manage classes & rosters"], ["STUDENT", "student", "🏋️", "Browse & sign up for classes"]].map(([label, val, icon, sub]) => (
            <button key={val} onClick={() => setMode(val)} style={{
              background: "linear-gradient(135deg, #1a1a1a, #111)", border: "1px solid #2a2a2a",
              borderRadius: 14, padding: "28px 32px", color: "#fff", cursor: "pointer",
              transition: "all 0.2s", flex: 1, textAlign: "center"
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#39ff14"; e.currentTarget.style.boxShadow = "0 0 24px rgba(57,255,20,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2 }}>{label}</div>
              <div style={{ color: "#555", fontSize: 12, marginTop: 4 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>
      <SpeedInsights />
    </div>
  );

  // ── PIN Gate ──
  if (mode === "coach" && !coachUnlocked) {
    return (
      <>
        <PinGate currentPin={coachPin} onSuccess={() => setCoachUnlocked(true)} onBack={() => setMode(null)} />
        <SpeedInsights />
      </>
    );
  }

  // ── Main Dashboard ──
  return (
    <div style={pageStyle}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      {showPinChange && <ChangePinModal currentPin={coachPin} onSave={handlePinSave} onClose={() => setShowPinChange(false)} />}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 60px" }}>
        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0 32px" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: "#fff", letterSpacing: 3, lineHeight: 1 }}>
              LETHAL <span style={{ color: "#39ff14" }}>BOXING</span>
            </div>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: 2, marginTop: 2 }}>{mode === "coach" ? "🔒 COACH PORTAL" : "CLASS SCHEDULE"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {mode === "coach" && (
              <button onClick={() => setShowPinChange(true)} style={{
                background: "transparent", border: "1px solid #2a2a2a", color: "#888",
                borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", letterSpacing: 1
              }}>🔑 PIN</button>
            )}
            <button onClick={() => { setMode(null); setCoachUnlocked(false); }} style={{
              background: "transparent", border: "1px solid #2a2a2a", color: "#666",
              borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", letterSpacing: 1
            }}>← EXIT</button>
          </div>
        </div>

        {/* PIN changed toast */}
        {pinChanged && (
          <div style={{ background: "rgba(57,255,20,0.1)", border: "1px solid #39ff14", borderRadius: 8, padding: "10px 16px", color: "#39ff14", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
            ✓ PIN updated successfully!
          </div>
        )}

        {/* Coach: create class */}
        {mode === "coach" && (
          <div style={{ marginBottom: 32 }}>
            {!showForm ? (
              <button onClick={() => setShowForm(true)} style={{
                background: "linear-gradient(90deg, #39ff14, #00cc00)", color: "#000", border: "none",
                borderRadius: 10, padding: "13px 28px", fontWeight: 800, cursor: "pointer",
                letterSpacing: 1.5, fontFamily: "'Bebas Neue', sans-serif", fontSize: 20
              }}>+ CREATE CLASS</button>
            ) : (
              <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 24 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "#fff", letterSpacing: 2, marginBottom: 20 }}>NEW CLASS</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    ["Class Title", "title", "text", "e.g. Beginner Sparring"],
                    ["Coach Name", "coach", "text", "optional"],
                    ["Date", "date", "date", ""],
                    ["Time", "time", "time", ""],
                    ["Duration (min)", "duration", "number", "60"],
                    ["Max Students", "capacity", "number", "12"],
                  ].map(([label, key, type, ph]) => (
                    <div key={key}>
                      <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, marginBottom: 4 }}>{label.toUpperCase()}</div>
                      <input type={type} placeholder={ph} value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "#555", letterSpacing: 1, marginBottom: 4 }}>CLASS DESCRIPTION</div>
                  <textarea placeholder="Describe the class — skill level, what to bring, what to expect..."
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
                </div>
                {formErr && <div style={{ color: "#ff3b3b", fontSize: 12, marginTop: 8 }}>{formErr}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={createClass} style={{
                    background: "linear-gradient(90deg, #39ff14, #00cc00)", color: "#000", border: "none",
                    borderRadius: 8, padding: "10px 24px", fontWeight: 800, fontSize: 14, cursor: "pointer", letterSpacing: 1
                  }}>SAVE CLASS</button>
                  <button onClick={() => { setShowForm(false); setFormErr(""); }} style={{
                    background: "transparent", color: "#666", border: "1px solid #2a2a2a",
                    borderRadius: 8, padding: "10px 24px", fontSize: 14, cursor: "pointer"
                  }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Class list */}
        {upcomingClasses.length === 0 ? (
          <div style={{ textAlign: "center", color: "#333", fontSize: 15, paddingTop: 60 }}>
            {mode === "coach" ? "No upcoming classes yet. Hit Create Class to get started." : "No classes scheduled yet. Check back soon!"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {upcomingClasses.map(cls => (
              <ClassCard key={cls.id} cls={cls} signups={signups} waitlists={waitlists}
                onSignup={handleSignup} onWaitlist={handleWaitlist}
                isCoach={mode === "coach"} onDelete={deleteClass}
                onRemoveStudent={removeStudent} onRemoveWaitlist={removeWaitlist}
                onPromoteWaitlist={promoteWaitlist} />
            ))}
          </div>
        )}
      </div>
      <SpeedInsights />
    </div>
  );
}
