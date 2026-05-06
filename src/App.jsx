import { useState, useEffect } from "react";

// A→B→休→C→休→A... のローテーション
const ROTATION = ["A", "B", null, "C", null];

const MENUS = {
  A: {
    label: "Day A",
    sub: "プッシュ系",
    color: "#ef4444",
    exercises: [
      { id: "bench", name: "ダンベルベンチプレス", sets: 3, reps: 10 },
      { id: "incline", name: "インクラインダンベルプレス", sets: 3, reps: 10 },
      { id: "shoulder", name: "ダンベルショルダープレス", sets: 3, reps: 10 },
      { id: "dips", name: "ディップス", sets: 3, reps: 8 },
    ],
  },
  B: {
    label: "Day B",
    sub: "プル系",
    color: "#3b82f6",
    exercises: [
      { id: "negpull", name: "ネガティブ懸垂", sets: 3, reps: 5 },
      { id: "row", name: "ダンベルロウ", sets: 3, reps: 10 },
      { id: "curl", name: "ダンベルカール", sets: 3, reps: 10 },
      { id: "kneerise", name: "ハンギングニーレイズ", sets: 3, reps: 10 },
    ],
  },
  C: {
    label: "Day C",
    sub: "レッグ＋体幹",
    color: "#10b981",
    exercises: [
      { id: "squat", name: "ダンベルスクワット", sets: 3, reps: 12 },
      { id: "lunge", name: "ダンベルランジ", sets: 3, reps: 10 },
      { id: "rdl", name: "ダンベルRDL", sets: 3, reps: 10 },
      { id: "plank", name: "プランク", sets: 3, reps: 30, unit: "秒" },
    ],
  },
};

const STORAGE_KEY = "training_log_v2";
const START_DATE_KEY = "training_start_date";
const OFFSET_KEY = "training_offset";

function loadLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveLog(log) { localStorage.setItem(STORAGE_KEY, JSON.stringify(log)); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function getStartDate() {
  let d = localStorage.getItem(START_DATE_KEY);
  if (!d) { d = todayStr(); localStorage.setItem(START_DATE_KEY, d); }
  return d;
}

function getOffset() {
  return parseInt(localStorage.getItem(OFFSET_KEY) || "0", 10);
}
function setOffset(n) {
  localStorage.setItem(OFFSET_KEY, String(n));
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

function getScheduledDay(dateStr, offset = 0) {
  const start = getStartDate();
  const diff = daysBetween(start, dateStr);
  if (diff < 0) return null;
  return ROTATION[(diff + offset) % ROTATION.length];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function App() {
  const [view, setView] = useState("home");
  const [activeDay, setActiveDay] = useState(null);
  const [log, setLog] = useState(loadLog);
  const [sets, setSets] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [offset, setOffsetState] = useState(getOffset);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  function skipDay() {
    const n = (offset + 1) % ROTATION.length;
    setOffset(n); setOffsetState(n);
  }
  function prevDay() {
    const n = (offset + ROTATION.length - 1) % ROTATION.length;
    setOffset(n); setOffsetState(n);
  }

  useEffect(() => {
    let interval;
    if (timerActive) interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  function startWorkout(day) {
    const menu = MENUS[day];
    const initial = {};
    menu.exercises.forEach((ex) => {
      const lastEntry = getLastEntry(day, ex.id);
      initial[ex.id] = Array.from({ length: ex.sets }, (_, i) => ({
        weight: lastEntry?.sets?.[i]?.weight ?? "",
        reps: lastEntry?.sets?.[i]?.reps ?? ex.reps,
        done: false,
      }));
    });
    setSets(initial);
    setActiveDay(day);
    setElapsed(0);
    setTimerActive(true);
    setView("workout");
  }

  function getLastEntry(day, exId) {
    const dayLog = log[day] || [];
    for (let i = dayLog.length - 1; i >= 0; i--) {
      const ex = dayLog[i].exercises?.find((e) => e.id === exId);
      if (ex) return ex;
    }
    return null;
  }

  function updateSet(exId, setIdx, field, value) {
    setSets((prev) => {
      const copy = { ...prev };
      copy[exId] = copy[exId].map((s, i) => i === setIdx ? { ...s, [field]: value } : s);
      return copy;
    });
  }

  function toggleDone(exId, setIdx) {
    setSets((prev) => {
      const copy = { ...prev };
      copy[exId] = copy[exId].map((s, i) => i === setIdx ? { ...s, done: !s.done } : s);
      return copy;
    });
  }

  function finishWorkout() {
    setTimerActive(false);
    const menu = MENUS[activeDay];
    const entry = {
      date: todayStr(),
      duration: elapsed,
      exercises: menu.exercises.map((ex) => ({
        id: ex.id, name: ex.name, sets: sets[ex.id],
      })),
    };
    const updated = { ...log };
    if (!updated[activeDay]) updated[activeDay] = [];
    updated[activeDay].push(entry);
    setLog(updated);
    saveLog(updated);
    setView("done");
  }

  const allDone = activeDay && MENUS[activeDay].exercises.every((ex) => sets[ex.id]?.every((s) => s.done));
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const totalSessions = Object.values(log).reduce((a, v) => a + v.length, 0);
  const todayScheduled = getScheduledDay(todayStr(), offset);

  const loggedDates = {};
  Object.entries(log).forEach(([day, entries]) => {
    entries.forEach((e) => { loggedDates[e.date] = day; });
  });

  function renderCalendar() {
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDow = getFirstDayOfWeek(calYear, calMonth);
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const todayDate = now.getDate();
    const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();

    return (
      <div style={s.calWrap}>
        <div style={s.calNav}>
          <button style={s.calNavBtn} onClick={() => {
            if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
            else setCalMonth(m => m - 1);
          }}>‹</button>
          <span style={s.calTitle}>{calYear}年{calMonth + 1}月</span>
          <button style={s.calNavBtn} onClick={() => {
            if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
            else setCalMonth(m => m + 1);
          }}>›</button>
        </div>
        <div style={s.calGrid}>
          {WEEKDAYS.map((w, i) => (
            <div key={w} style={{ ...s.calWeekday, color: i === 0 ? "#ef4444" : i === 6 ? "#60a5fa" : "#666" }}>{w}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const scheduled = getScheduledDay(dateStr, offset);
            const logged = loggedDates[dateStr];
            const isToday = isCurrentMonth && d === todayDate;
            const color = logged ? MENUS[logged]?.color : scheduled ? MENUS[scheduled]?.color : null;

            return (
              <div key={d} style={{
                ...s.calCell,
                background: isToday ? "#1e1e1e" : "transparent",
                border: isToday ? "1.5px solid #fff" : "1.5px solid transparent",
              }}>
                <div style={{ ...s.calDayNum, color: isToday ? "#fff" : "#aaa" }}>{d}</div>
                {scheduled && (
                  <div style={{ ...s.calDot, background: color, opacity: logged ? 1 : 0.3 }}>
                    {logged ? "✓" : scheduled}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={s.calLegend}>
          {Object.entries(MENUS).map(([k, m]) => (
            <div key={k} style={s.calLegendItem}>
              <div style={{ ...s.calLegendDot, background: m.color }} />{m.label}
            </div>
          ))}
          <div style={s.calLegendItem}><div style={{ ...s.calLegendDot, background: "#333" }} />休</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.grain} />

      {view === "home" && (
        <div style={s.page}>
          <div style={s.header}>
            <div style={s.logo}>IRON LOG</div>
            <div style={s.stat}>
              <span style={s.statNum}>{totalSessions}</span>
              <span style={s.statLabel}>回達成</span>
            </div>
          </div>
          <div style={s.tagline}>細マッチョへの道</div>

          <div style={{ ...s.todayBanner, borderColor: todayScheduled ? MENUS[todayScheduled].color : "#333" }}>
            <div style={{ flex: 1 }}>
              <span style={s.todayLabel}>今日は　</span>
              {todayScheduled ? (
                <span style={{ ...s.todayDay, color: MENUS[todayScheduled].color }}>
                  {MENUS[todayScheduled].label} — {MENUS[todayScheduled].sub}
                </span>
              ) : (
                <span style={s.todayRest}>🛌 休息日</span>
              )}
            </div>
            <div style={s.skipRow}>
              <button style={s.skipBtn} onClick={prevDay} title="1日戻す">‹</button>
              <span style={s.skipLabel}>ずらす</span>
              <button style={s.skipBtn} onClick={skipDay} title="1日スキップ">›</button>
            </div>
          </div>

          {renderCalendar()}

          <div style={s.dayGrid}>
            {Object.entries(MENUS).map(([key, menu]) => {
              const last = (log[key] || []).at(-1);
              const isToday = todayScheduled === key;
              return (
                <button key={key} style={{
                  ...s.dayCard,
                  borderColor: isToday ? menu.color : "#2a2a2a",
                  boxShadow: isToday ? `0 0 14px ${menu.color}44` : "none",
                }} onClick={() => startWorkout(key)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ ...s.dayBadge, background: menu.color }}>{menu.label}</div>
                    {isToday && <div style={s.todayBadge}>TODAY</div>}
                  </div>
                  <div style={s.daySub}>{menu.sub}</div>
                  <div style={s.dayExList}>
                    {menu.exercises.map((e) => (
                      <div key={e.id} style={s.dayExItem}>· {e.name}</div>
                    ))}
                  </div>
                  {last && <div style={s.lastDate}>前回: {last.date}</div>}
                  <div style={{ ...s.startBtn, background: menu.color }}>開始 →</div>
                </button>
              );
            })}
          </div>

          <button style={s.histBtn} onClick={() => setView("history")}>📊 履歴・グラフを見る</button>
        </div>
      )}

      {view === "workout" && activeDay && (
        <div style={s.page}>
          <div style={s.workoutHeader}>
            <button style={s.backBtn} onClick={() => { setTimerActive(false); setView("home"); }}>← 戻る</button>
            <div style={{ ...s.dayBadge, background: MENUS[activeDay].color }}>
              {MENUS[activeDay].label} / {MENUS[activeDay].sub}
            </div>
            <div style={s.timer}>{fmt(elapsed)}</div>
          </div>
          {MENUS[activeDay].exercises.map((ex) => {
            const exSets = sets[ex.id] || [];
            const allExDone = exSets.every((st) => st.done);
            return (
              <div key={ex.id} style={{ ...s.exCard, opacity: allExDone ? 0.6 : 1 }}>
                <div style={s.exName}>{allExDone ? "✅ " : ""}{ex.name}</div>
                <div style={s.setHeader}>
                  <span>セット</span><span>重量(kg)</span><span>{ex.unit || "回数"}</span><span>完了</span>
                </div>
                {exSets.map((st, i) => (
                  <div key={i} style={{ ...s.setRow, background: st.done ? "#1a2a1a" : "#1a1a1a" }}>
                    <span style={{ textAlign: "center" }}>{i + 1}</span>
                    {ex.unit ? <span style={{ textAlign: "center" }}>—</span> : (
                      <input style={s.setInput} type="number" value={st.weight} placeholder="0"
                        onChange={(e) => updateSet(ex.id, i, "weight", e.target.value)} />
                    )}
                    <input style={s.setInput} type="number" value={st.reps}
                      onChange={(e) => updateSet(ex.id, i, "reps", e.target.value)} />
                    <button style={{ ...s.doneBtn, background: st.done ? "#10b981" : "#333" }}
                      onClick={() => toggleDone(ex.id, i)}>{st.done ? "✓" : "○"}</button>
                  </div>
                ))}
              </div>
            );
          })}
          <button style={{ ...s.finishBtn, opacity: allDone ? 1 : 0.4 }} disabled={!allDone} onClick={finishWorkout}>
            🏁 トレーニング完了
          </button>
        </div>
      )}

      {view === "done" && (
        <div style={s.page}>
          <div style={s.doneBox}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔥</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>お疲れ様！</div>
            <div style={{ fontSize: 20, color: "#ef4444", fontWeight: 700, marginBottom: 8 }}>{fmt(elapsed)} で完了</div>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 32 }}>細マッチョへ一歩近づいた</div>
            <button style={s.homeBtn} onClick={() => setView("home")}>ホームへ</button>
          </div>
        </div>
      )}

      {view === "history" && <HistoryView log={log} onBack={() => setView("home")} />}
    </div>
  );
}

function HistoryView({ log, onBack }) {
  const [selectedDay, setSelectedDay] = useState("A");
  const entries = log[selectedDay] || [];
  const chartData = entries.map((entry) => {
    const vol = entry.exercises.reduce((sum, ex) =>
      sum + ex.sets.reduce((s2, set) =>
        s2 + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0);
    return { date: entry.date, vol };
  });
  const maxVol = Math.max(...chartData.map((d) => d.vol), 1);

  return (
    <div style={s.page}>
      <div style={s.workoutHeader}>
        <button style={s.backBtn} onClick={onBack}>← 戻る</button>
        <div style={s.logo}>履歴</div>
        <div />
      </div>
      <div style={s.tabRow}>
        {["A", "B", "C"].map((d) => (
          <button key={d} style={{
            ...s.tab,
            background: selectedDay === d ? MENUS[d].color : "#1a1a1a",
            color: selectedDay === d ? "#fff" : "#888",
          }} onClick={() => setSelectedDay(d)}>Day {d}</button>
        ))}
      </div>
      {chartData.length === 0 ? (
        <div style={{ textAlign: "center", color: "#555", padding: "40px 0" }}>まだ記録がありません</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#666", letterSpacing: "0.1em", marginBottom: 12 }}>トレーニングボリューム推移</div>
          <div style={s.chart}>
            {chartData.map((d, i) => (
              <div key={i} style={s.chartCol}>
                <div style={{ width: "100%", height: 70, display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "70%", margin: "0 auto", borderRadius: "4px 4px 0 0", minHeight: 4,
                    height: `${(d.vol / maxVol) * 100}%`, background: MENUS[selectedDay].color }} />
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{d.date.slice(5)}</div>
                <div style={{ fontSize: 9, color: "#444" }}>{d.vol > 0 ? `${d.vol}kg` : "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...entries].reverse().map((entry, i) => (
              <div key={i} style={s.histCard}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{entry.date}</span>
                  <span style={{ fontSize: 12, color: "#888" }}>⏱ {Math.round(entry.duration / 60)}分</span>
                </div>
                {entry.exercises.map((ex) => (
                  <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                    <span style={{ color: "#ddd" }}>{ex.name}</span>
                    <span style={{ color: "#888" }}>
                      {ex.sets.map((st) => st.weight ? `${st.weight}kg×${st.reps}` : `${st.reps}回`).join(" / ")}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "#0d0d0d", color: "#f0f0f0", fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif", position: "relative" },
  grain: { position: "fixed", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")", pointerEvents: "none", zIndex: 0 },
  page: { position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", padding: "20px 16px 40px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  logo: { fontSize: 28, fontWeight: 900, letterSpacing: "0.15em", color: "#fff" },
  stat: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  statNum: { fontSize: 32, fontWeight: 900, color: "#ef4444", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#888" },
  tagline: { fontSize: 12, color: "#666", letterSpacing: "0.2em", marginBottom: 16 },
  todayBanner: { display: "flex", alignItems: "center", gap: 10, background: "#141414", border: "1px solid", borderRadius: 10, padding: "12px 16px", marginBottom: 16 },
  todayLabel: { fontSize: 12, color: "#666" },
  todayDay: { fontSize: 16, fontWeight: 700 },
  todayRest: { fontSize: 15, color: "#888" },
  skipRow: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 },
  skipBtn: { background: "#2a2a2a", border: "none", color: "#aaa", fontSize: 18, width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  skipLabel: { fontSize: 10, color: "#555" },
  calWrap: { background: "#141414", borderRadius: 12, padding: "14px", marginBottom: 20 },
  calNav: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  calNavBtn: { background: "none", border: "none", color: "#aaa", fontSize: 20, cursor: "pointer", padding: "0 8px" },
  calTitle: { fontSize: 14, fontWeight: 700, color: "#fff" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 },
  calWeekday: { textAlign: "center", fontSize: 10, fontWeight: 700, padding: "4px 0 6px" },
  calCell: { borderRadius: 6, padding: "3px 2px", textAlign: "center", minHeight: 42 },
  calDayNum: { fontSize: 11, marginBottom: 2 },
  calDot: { fontSize: 9, fontWeight: 700, color: "#fff", borderRadius: 4, padding: "1px 3px", margin: "0 auto", display: "inline-block" },
  calLegend: { display: "flex", gap: 12, marginTop: 10, justifyContent: "center" },
  calLegendItem: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#888" },
  calLegendDot: { width: 8, height: 8, borderRadius: 2 },
  todayBadge: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#ef4444", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em" },
  dayGrid: { display: "flex", flexDirection: "column", gap: 10 },
  dayCard: { background: "#141414", border: "1.5px solid", borderRadius: 12, padding: "14px", textAlign: "left", cursor: "pointer", transition: "box-shadow 0.2s" },
  dayBadge: { display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#fff", borderRadius: 4, padding: "2px 8px", marginBottom: 6 },
  daySub: { fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff" },
  dayExList: { marginBottom: 8 },
  dayExItem: { fontSize: 12, color: "#999", lineHeight: 1.7 },
  lastDate: { fontSize: 11, color: "#555", marginBottom: 6 },
  startBtn: { display: "inline-block", fontSize: 13, fontWeight: 700, color: "#fff", borderRadius: 6, padding: "5px 12px", marginTop: 2 },
  histBtn: { marginTop: 16, width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, color: "#aaa", fontSize: 14, padding: "14px", cursor: "pointer" },
  workoutHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { background: "none", border: "none", color: "#888", fontSize: 14, cursor: "pointer", padding: 0 },
  timer: { fontSize: 22, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums" },
  exCard: { background: "#141414", borderRadius: 10, padding: "14px", marginBottom: 12, transition: "opacity 0.3s" },
  exName: { fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#fff" },
  setHeader: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", fontSize: 11, color: "#666", marginBottom: 6, textAlign: "center" },
  setRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", alignItems: "center", borderRadius: 6, padding: "6px 0", marginBottom: 4, textAlign: "center", fontSize: 14 },
  setInput: { width: "60px", background: "#222", border: "1px solid #333", borderRadius: 4, color: "#fff", fontSize: 14, padding: "4px 6px", textAlign: "center", margin: "0 auto", display: "block" },
  doneBtn: { width: 32, height: 32, borderRadius: "50%", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", margin: "0 auto", display: "block", transition: "background 0.2s" },
  finishBtn: { marginTop: 20, width: "100%", background: "#ef4444", border: "none", borderRadius: 10, color: "#fff", fontSize: 16, fontWeight: 700, padding: "16px", cursor: "pointer", transition: "opacity 0.2s" },
  doneBox: { textAlign: "center", paddingTop: 60 },
  homeBtn: { background: "#ef4444", border: "none", borderRadius: 10, color: "#fff", fontSize: 16, fontWeight: 700, padding: "14px 40px", cursor: "pointer" },
  tabRow: { display: "flex", gap: 8, marginBottom: 20 },
  tab: { flex: 1, border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" },
  chart: { display: "flex", alignItems: "flex-end", gap: 6, height: 120, background: "#141414", borderRadius: 10, padding: "12px 8px 8px", marginBottom: 20, overflowX: "auto" },
  chartCol: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40, flex: 1 },
  histCard: { background: "#141414", borderRadius: 10, padding: "14px" },
};
