/* ------------------------------------------
   AXIS OS // core.js
   HUD Chronometer, Daily Score Engine, Core Home,
   and Quick Clipboard Bridge
   ------------------------------------------ */

const REVOLUTION_RANKS = [
  {
    level: 1,
    name: "RANK I: CIVILIAN // المتمرد",
    minScoreSum: 0,
    color: "var(--text-muted)",
  },
  {
    level: 2,
    name: "RANK II: VANGUARD // الطليعة",
    minScoreSum: 500,
    color: "var(--hud-cyan)",
  },
  {
    level: 3,
    name: "RANK III: RADICAL // الراديكالي",
    minScoreSum: 1200,
    color: "var(--hud-violet)",
  },
  {
    level: 4,
    name: "RANK IV: LIBERATOR // المحرر",
    minScoreSum: 2500,
    color: "var(--hud-optimal)",
  },
  {
    level: 5,
    name: "RANK V: COMMANDER // القائد",
    minScoreSum: 4500,
    color: "var(--hud-warning)",
  },
  {
    level: 6,
    name: "RANK VI: ARCHITECT // مهندس الثورة",
    minScoreSum: 7500,
    color: "#f43f5e",
  },
  {
    level: 7,
    name: "RANK VII: SOVEREIGN // السيادة",
    minScoreSum: 12000,
    color: "#fff",
  },
];

let todayTelemetry = {
  gymLogged: localStorage.getItem("axis_today_gym") === "true",
  gymSplit: localStorage.getItem("axis_today_gym_split") || "None",
  designHours: parseFloat(localStorage.getItem("axis_today_design")) || 0,
  sleepHours: parseFloat(localStorage.getItem("axis_today_sleep")) || 0,
  waterLiters: parseFloat(localStorage.getItem("axis_today_water")) || 0,
  wentOutside: localStorage.getItem("axis_today_outside") === "true",
  watchedTutorial: localStorage.getItem("axis_today_tutorial") === "true",
  lastLoggedTimestamp:
    parseInt(localStorage.getItem("axis_last_logged_time")) || 0,
  streakCurrent: parseInt(localStorage.getItem("axis_streak_curr")) || 12,
  streakLongest: parseInt(localStorage.getItem("axis_streak_long")) || 24,
  lastBreakDate: localStorage.getItem("axis_streak_break") || "2026-05-01",
  totalHistoricalScore:
    parseInt(localStorage.getItem("axis_total_score")) || 1420,
  fitnessScoreV4: 0,
  nutritionScoreV4: 0,
  sleepScoreV4: 0,
  readingScoreV4: 0,
  destinyTier: 0,
  destinyTitle: "",
  destinyBonusPoints: 0,
  destinyProofUrl: "",
  effortV4: 0,
  dayScoreV4: 0,
  gradeV4: "ROT",
  primaryModeV4: "desk",
  deskEffV4: 0,
  uniEffV4: 0,
  fieldEffV4: 0,
  mustWinDoneV4: false,
  farmingRatioV4: 0,
  ritualsDoneV4: 0,
  ritualsTotalV4: 0,
  ritualsCappedV4: 0,
  gradeMetaV4: {
    label: "ROT",
    color: "#333333",
    desc: "No must-win, no real work",
  },
};

window.axisPendingDailyMutation = false;
window.axisPendingCoreMutation = false;

let clipboardState = {
  items: JSON.parse(localStorage.getItem("axis_clipboard_items") || "[]"),
  syncMode: "local",
  lastError: "",
  isEditing: false,
  draft: "",
  modalOpen: false,
};

let coreDataState = {
  balance: JSON.parse(localStorage.getItem("axis_core_balance") || "null") || {
    id: "",
    label: "Main Balance",
    amount: 0,
  },
  todos: JSON.parse(localStorage.getItem("axis_core_todos") || "[]"),
  markers: JSON.parse(localStorage.getItem("axis_core_markers") || "[]"),
  momentum: {
    tasks: [],
    rituals: [],
    taskTotals: {
      active: 0,
      currentBest: 0,
      longestBest: 0,
      totalCurrent: 0,
      tier: { key: "none", label: "NONE", rank: 0 },
    },
    ritualTotals: {
      active: 0,
      currentBest: 0,
      longestBest: 0,
      totalCurrent: 0,
      tier: { key: "none", label: "NONE", rank: 0 },
    },
    totalCurrent: 0,
    totalLongest: 0,
    overallTier: { key: "none", label: "NONE", rank: 0 },
  },
  review: null,
  draftBalanceLabel: "",
  draftBalanceAmount: "",
  draftTodo: "",
  draftTodoIsDaily: false,
  draftTodoPoints: 1,
  draftTaskKind: "task",
  draftTaskMode: "desk",
  draftTaskImpact: 1,
  draftTaskResistance: 1,
  draftTaskDepth: 0,
  draftTaskDoneDefinition: "",
  draftIncomingCritical: false,
  draftMarkerTitle: "",
  draftMarkerDate: "",
  draftMarkerType: "deadline",
  draftMarkerNote: "",
  draftDestinyTier: 0,
  draftDestinyTitle: "",
  draftDestinyProofUrl: "",
  draftDestinyBonus: "",
  taskModalOpen: false,
  isEditing: false,
  syncMode: "local",
  lastError: "",
};

function initCore() {
  init12hClock();
  renderCoreHome();
  computeAndDisplayScore();
  loadDailyFromServer({ silent: true });
  loadClipboardFromServer({ silent: true });
  loadCoreDataFromServer({ silent: true });
}

function init12hClock() {
  const timeEl = document.getElementById("hud-live-clock");
  const dateEl = document.getElementById("hud-live-date");

  function update() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    h = String(h).padStart(2, "0");

    if (timeEl) timeEl.textContent = `${h}:${m}:${s} ${ampm}`;

    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    if (dateEl)
      dateEl.textContent = `${days[now.getDay()]} // ${String(now.getDate()).padStart(2, "0")} ${months[now.getMonth()]} ${now.getFullYear()}`;
    updateHudAgeChip();
  }

  update();
  setInterval(update, 500);
}

function getAxisBirthdayValue() {
  return String(localStorage.getItem("axis_birthday") || "").trim();
}

function calculateAxisAgeParts(birthdayValue) {
  const value = String(birthdayValue || "").trim();
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonthDays = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    ).getDate();
    days += previousMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return null;
  return { years, months, days };
}

function updateHudAgeChip() {
  const chip = document.getElementById("hud-age-chip");
  if (!chip) return;
  const parts = calculateAxisAgeParts(getAxisBirthdayValue());
  if (!parts) {
    chip.textContent = "AGE • SET IN CONFIG";
    return;
  }
  chip.textContent = `AGE • ${parts.years}Y ${parts.months}M ${parts.days}D`;
}

function currentAxisDayKeyClient() {
  const shifted = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayTodoPoints() {
  const key = currentAxisDayKeyClient();
  return (coreDataState.todos || []).reduce((sum, todo) => {
    if (todo.is_done && todo.completed_day_key === key) {
      return sum + Number(todo.points || 1);
    }
    return sum;
  }, 0);
}

function computeDailyScore() {
  return Number(todayTelemetry.dayScoreV4 || 0);
}

function getCurrentRank() {
  let total = todayTelemetry.totalHistoricalScore;
  let rank = REVOLUTION_RANKS[0];
  for (const r of REVOLUTION_RANKS) {
    if (total >= r.minScoreSum) rank = r;
    else break;
  }
  return rank;
}

function getLastLoggedString() {
  if (!todayTelemetry.lastLoggedTimestamp) return "NOTHING LOGGED TODAY";
  const diffMinutes = Math.floor(
    (Date.now() - todayTelemetry.lastLoggedTimestamp) / (1000 * 60),
  );
  if (diffMinutes < 1) return "LAST LOGGED: JUST NOW";
  if (diffMinutes < 60) return `LAST LOGGED: ${diffMinutes} MINUTES AGO`;
  return `LAST LOGGED: ${Math.floor(diffMinutes / 60)} HOURS AGO`;
}

function calculateTaskPointsAutoClient(kind, impact, resistance, depth) {
  if (String(kind || "task") === "ritual") return 1;
  const score = Number(impact || 1) + Number(resistance || 1);
  let tier =
    score <= 2 ? 1 : score === 3 ? 2 : score === 4 ? 3 : score === 5 ? 5 : 8;
  if (Number(depth || 0) === 1) {
    tier =
      tier === 1 ? 2 : tier === 2 ? 3 : tier === 3 ? 5 : tier === 5 ? 8 : 13;
  }
  return tier;
}

function taskCanCommitForPointsClient(incomingCritical = false) {
  if (incomingCritical) return true;
  const now = new Date();
  const cairo = new Date(
    now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }),
  );
  const hour = cairo.getHours();
  return hour >= 6 && hour < 10;
}

function getTaskDraftPreview() {
  const kind = coreDataState.draftTaskKind || "task";
  const locked = !taskCanCommitForPointsClient(
    coreDataState.draftIncomingCritical,
  );
  const autoBase = calculateTaskPointsAutoClient(
    kind,
    coreDataState.draftTaskImpact,
    coreDataState.draftTaskResistance,
    coreDataState.draftTaskDepth,
  );
  const auto = kind === "ritual" ? 1 : locked ? 0 : autoBase;
  const effective =
    kind === "ritual"
      ? 1
      : Math.min(
          auto,
          Math.max(0, Number(coreDataState.draftTodoPoints || auto)),
        );
  return {
    kind,
    auto,
    effective,
    mustWin: kind === "task" && auto >= 5,
    locked,
  };
}

function formatModeLabel(mode = "desk") {
  const clean = String(mode || "desk")
    .trim()
    .toLowerCase();
  if (clean === "uni") return "Summer";
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Desk";
}

function formatDeltaStat(value, suffix = "") {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num === 0) return "Flat";
  const whole = Math.abs(num - Math.round(num)) < 0.05;
  const display = whole ? String(Math.round(num)) : num.toFixed(1);
  return `${num > 0 ? "+" : ""}${display}${suffix}`;
}

function getMomentumTierClass(tierKey = "none") {
  const clean = String(tierKey || "none").toLowerCase();
  return ["ember", "spark", "flare", "blaze", "inferno"].includes(clean)
    ? clean
    : "none";
}

function getTaskMomentumEntry(todo = {}) {
  const source =
    String(todo.task_kind || "task") === "ritual"
      ? coreDataState.momentum?.rituals || []
      : coreDataState.momentum?.tasks || [];
  return (
    source.find(
      (item) => item.task_id === todo.id || item.title === todo.title,
    ) || null
  );
}

function renderMomentumChips() {
  const tasks = coreDataState.momentum?.tasks || [];
  if (!tasks.length) {
    return `<div class="text-sm text-muted">No task streaks yet.</div>`;
  }
  return `<div class="row flex-wrap" style="gap: 8px;">${tasks
    .slice(0, 6)
    .map(
      (item) =>
        `<span class="badge badge-muted axis-streak-badge axis-streak-${getMomentumTierClass(item.tier?.key)}">${escapeHtml(item.tier?.label || "STREAK")} • ${item.currentStreak || 0}d</span>`,
    )
    .join("")}</div>`;
}

function renderTaskCaptureFormHTML() {
  const preview = getTaskDraftPreview();
  return `
        <form onsubmit="handleTodoAdd(event)" class="stack stack-sm">
            <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 12px;">
                <div class="stack stack-sm">
                    <label class="form-label">Type</label>
                    <select class="tactical-select" onchange="updateTaskDraftMeta('kind', this.value)">
                        <option value="task" ${coreDataState.draftTaskKind === "task" ? "selected" : ""}>Task</option>
                        <option value="ritual" ${coreDataState.draftTaskKind === "ritual" ? "selected" : ""}>Ritual</option>
                    </select>
                </div>
                <div class="stack stack-sm">
                    <label class="form-label">Mode</label>
                    <select class="tactical-select" onchange="updateTaskDraftMeta('mode', this.value)" ${coreDataState.draftTaskKind === "ritual" ? "disabled" : ""}>
                        <option value="desk" ${coreDataState.draftTaskMode === "desk" ? "selected" : ""}>Desk</option>
                        <option value="uni" ${coreDataState.draftTaskMode === "uni" ? "selected" : ""}>Summer</option>
                        <option value="field" ${coreDataState.draftTaskMode === "field" ? "selected" : ""}>Field</option>
                    </select>
                </div>
            </div>
            <input id="axis-todo-input" class="tactical-input" placeholder="Title" value="${escapeHtml(coreDataState.draftTodo || "")}" oninput="updateTodoDraft(this.value)">
            <input class="tactical-input" placeholder="Done definition / proof" value="${escapeHtml(coreDataState.draftTaskDoneDefinition || "")}" oninput="updateTaskDraftMeta('doneDefinition', this.value)">
            <div class="grid grid-cols-1 md-grid-cols-3" style="gap: 12px;">
                <div class="stack stack-sm">
                    <label class="form-label">Impact</label>
                    <select class="tactical-select" onchange="updateTaskDraftMeta('impact', this.value)" ${coreDataState.draftTaskKind === "ritual" ? "disabled" : ""}>
                        <option value="1" ${Number(coreDataState.draftTaskImpact) === 1 ? "selected" : ""}>1</option>
                        <option value="2" ${Number(coreDataState.draftTaskImpact) === 2 ? "selected" : ""}>2</option>
                        <option value="3" ${Number(coreDataState.draftTaskImpact) === 3 ? "selected" : ""}>3</option>
                    </select>
                </div>
                <div class="stack stack-sm">
                    <label class="form-label">Resistance</label>
                    <select class="tactical-select" onchange="updateTaskDraftMeta('resistance', this.value)" ${coreDataState.draftTaskKind === "ritual" ? "disabled" : ""}>
                        <option value="1" ${Number(coreDataState.draftTaskResistance) === 1 ? "selected" : ""}>1</option>
                        <option value="2" ${Number(coreDataState.draftTaskResistance) === 2 ? "selected" : ""}>2</option>
                        <option value="3" ${Number(coreDataState.draftTaskResistance) === 3 ? "selected" : ""}>3</option>
                    </select>
                </div>
                <div class="stack stack-sm">
                    <label class="form-label">Depth</label>
                    <select class="tactical-select" onchange="updateTaskDraftMeta('depth', this.value)" ${coreDataState.draftTaskKind === "ritual" ? "disabled" : ""}>
                        <option value="0" ${Number(coreDataState.draftTaskDepth) === 0 ? "selected" : ""}>0</option>
                        <option value="1" ${Number(coreDataState.draftTaskDepth) === 1 ? "selected" : ""}>1</option>
                    </select>
                </div>
            </div>
            <div class="axis-chip-row">
                <label class="badge badge-muted axis-check-pill">
                    <input type="checkbox" ${coreDataState.draftTodoIsDaily ? "checked" : ""} onchange="updateTodoDaily(this.checked)"> Daily
                </label>
                <label class="badge badge-muted axis-check-pill">
                    <input type="checkbox" ${coreDataState.draftIncomingCritical ? "checked" : ""} onchange="updateTaskDraftMeta('incomingCritical', this.checked)"> Incoming critical
                </label>
                <label class="badge badge-accent">Auto ${preview.auto}pt</label>
                <label class="badge ${preview.mustWin ? "badge-warning" : "badge-muted"}">${preview.mustWin ? "Must-win" : "Normal"}</label>
                ${preview.locked && preview.kind === "task" ? `<label class="badge badge-critical">Locked after 10am</label>` : ""}
            </div>
            <div class="stack stack-sm">
                <label class="form-label">Effective points</label>
                <input type="number" min="0" max="${preview.auto}" step="1" class="tactical-input" value="${Number(coreDataState.draftTodoPoints || preview.auto)}" oninput="updateTodoPoints(this.value)">
            </div>
            <button type="submit" class="tactical-btn tactical-btn-primary w-full" style="justify-content:center;">Commit ${preview.kind === "ritual" ? "ritual" : "task"}</button>
        </form>
    `;
}

function renderCoreHome() {
  const container = document.getElementById("module-core");
  if (!container) return;

  const dayScore = Number(todayTelemetry.dayScoreV4 || 0);
  const effort = Number(todayTelemetry.effortV4 || 0);
  const latestClipboard =
    clipboardState.items[0]?.content || "No clipboard items yet.";
  const rituals = (coreDataState.todos || []).filter(
    (todo) => todo.task_kind === "ritual",
  );
  const workTasks = (coreDataState.todos || []).filter(
    (todo) => todo.task_kind !== "ritual",
  );
  const primaryMode = String(todayTelemetry.primaryModeV4 || "desk");
  const destinyActive = Number(todayTelemetry.destinyTier || 0) > 0;

  container.innerHTML = `
        <section class="axis-hero-grid">
            <div class="cockpit-card axis-score-card">
                <div class="axis-panel-head">
                    <div class="stack stack-sm" style="gap: 8px;">
                        <span class="axis-section-overline">Today</span>
                        <div class="axis-score-figure">${dayScore}</div>
                    </div>
                    <div class="stack stack-sm" style="align-items: flex-end; gap: 10px;">
                        <span class="badge badge-accent">${todayTelemetry.gradeV4 || "ROT"}</span>
                        <span class="badge badge-muted">Effort ${effort}/90</span>
                        ${destinyActive ? `<span class="badge badge-warning">Destiny T${todayTelemetry.destinyTier}</span>` : `<span class="badge badge-muted">No destiny</span>`}
                    </div>
                </div>
                <div class="axis-score-strip">
                    <div class="axis-mini-stat"><span class="axis-mini-stat-label">Nutrition</span><strong class="axis-mini-stat-value">${todayTelemetry.nutritionScoreV4 || 0}</strong></div>
                    <div class="axis-mini-stat"><span class="axis-mini-stat-label">Sleep</span><strong class="axis-mini-stat-value">${todayTelemetry.sleepScoreV4 || 0}</strong></div>
                    <div class="axis-mini-stat"><span class="axis-mini-stat-label">Fitness</span><strong class="axis-mini-stat-value">${todayTelemetry.fitnessScoreV4 || 0}</strong></div>
                    <div class="axis-mini-stat"><span class="axis-mini-stat-label">Reading</span><strong class="axis-mini-stat-value">${todayTelemetry.readingScoreV4 || 0}</strong></div>
                    <div class="axis-mini-stat"><span class="axis-mini-stat-label">Primary</span><strong class="axis-mini-stat-value">${Math.max(todayTelemetry.deskEffV4 || 0, todayTelemetry.uniEffV4 || 0, todayTelemetry.fieldEffV4 || 0)}</strong></div>
                    <div class="axis-mini-stat"><span class="axis-mini-stat-label">Bonus</span><strong class="axis-mini-stat-value">${todayTelemetry.destinyBonusPoints || 0}</strong></div>
                </div>
                <div class="axis-quiet-note">${todayTelemetry.gradeMetaV4?.desc || "No real work yet."}</div>
            </div>

            <div class="cockpit-card axis-primary-card">
                <div class="stack stack-sm" style="gap: 8px;">
                    <span class="axis-section-overline">Primary focus</span>
                    <div style="font-size: clamp(1.6rem, 4vw, 2.3rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.04;">${formatModeLabel(primaryMode)}</div>
                </div>
                <div class="axis-mode-grid">
                    <div class="axis-mode-card ${primaryMode === "desk" ? "active" : ""}"><span>Desk</span><strong>${todayTelemetry.deskEffV4 || 0}</strong></div>
                    <div class="axis-mode-card ${primaryMode === "uni" ? "active" : ""}"><span>Summer</span><strong>${todayTelemetry.uniEffV4 || 0}</strong></div>
                    <div class="axis-mode-card ${primaryMode === "field" ? "active" : ""}"><span>Field</span><strong>${todayTelemetry.fieldEffV4 || 0}</strong></div>
                </div>
                <div class="axis-chip-row">
                    <span class="badge ${todayTelemetry.mustWinDoneV4 ? "badge-optimal" : "badge-warning"}">${todayTelemetry.mustWinDoneV4 ? "Must-win done" : "Must-win gate active"}</span>
                    <span class="badge badge-muted">Farming ${(Number(todayTelemetry.farmingRatioV4 || 0) * 100).toFixed(0)}%</span>
                    <span class="badge badge-muted">Ritual cap ${todayTelemetry.ritualsCappedV4 || 0}/5</span>
                </div>
                <div class="axis-quiet-note">Primary is auto-derived from completed work. Fitness, sleep, nutrition, and reading are background synced now — no manual daily buttons here.</div>
            </div>

            <div class="cockpit-card axis-momentum-card">
                <div class="stack stack-sm" style="gap: 8px;">
                    <span class="axis-section-overline">Momentum</span>
                    <div style="font-size: clamp(2rem, 6vw, 3.1rem); font-weight: 700; letter-spacing: -0.05em; line-height: 0.98;">${coreDataState.momentum?.taskTotals?.currentBest || 0}d</div>
                    <div class="axis-muted-caption">Longest ${coreDataState.momentum?.taskTotals?.longestBest || 0}d • Active ${coreDataState.momentum?.taskTotals?.active || 0}</div>
                </div>
                ${renderMomentumChips()}
                <div class="axis-quiet-note">Task momentum is now derived from actual completion history. Ritual streaks still exist, but the main momentum block is task-based.</div>
            </div>
        </section>

        <section class="grid grid-cols-1" style="gap: 18px;">
            <div class="cockpit-card stack stack-md axis-tasks-card" style="padding: 26px 28px; gap: 18px;">
                <div class="axis-panel-head">
                    <div class="stack stack-sm" style="gap: 6px;">
                        <span class="axis-section-overline" style="color: var(--hud-violet);">Focus</span>
                        <div style="font-size: 1.14rem; font-weight: 650; letter-spacing: -0.012em;">Rituals pinned first, then work.</div>
                    </div>
                    <div class="axis-chip-row">
                        <button id="axis-open-task-modal" type="button" class="tactical-btn tactical-btn-primary" onclick="openTaskModal()">Add task</button>
                        <button type="button" class="tactical-btn" style="padding: 5px 10px; font-size: 0.68rem;" onclick="clearDoneTodos()">Clear done</button>
                    </div>
                </div>
                <div class="axis-inline-group" style="gap: 10px;">
                    <div class="axis-inline-group-head">
                        <span class="badge badge-cyan">Rituals</span>
                        <span class="axis-muted-caption">${todayTelemetry.ritualsDoneV4 || 0}/${todayTelemetry.ritualsTotalV4 || rituals.length}</span>
                    </div>
                    <div class="axis-task-list" style="gap: 10px;">${renderTodoListHTML(rituals)}</div>
                </div>
                <div class="divider"></div>
                <div class="axis-inline-group" style="gap: 10px;">
                    <div class="axis-inline-group-head">
                        <span class="badge badge-accent">Tasks</span>
                        <span class="axis-muted-caption">${workTasks.length} open</span>
                    </div>
                    <div class="axis-task-list" style="gap: 10px;">${renderTodoListHTML(workTasks)}</div>
                </div>
            </div>
        </section>

        <section class="grid grid-cols-1 md-grid-cols-2" style="gap: 18px; align-items: start;">
            <div class="cockpit-card stack stack-md">
                <div class="axis-panel-head">
                    <div class="stack stack-sm" style="gap: 6px;">
                        <span class="axis-section-overline">Weekly review</span>
                        <div style="font-size: 1.05rem; font-weight: 650; letter-spacing: -0.01em;">Enough signal, not more.</div>
                    </div>
                </div>
                ${renderWeeklyReviewHTML()}
            </div>

            <div class="cockpit-card stack stack-md">
                <div class="axis-panel-head">
                    <div class="stack stack-sm" style="gap: 6px;">
                        <span class="axis-section-overline">Clipboard</span>
                        <div style="font-size: 1.05rem; font-weight: 650; letter-spacing: -0.01em;">Latest captured thought.</div>
                    </div>
                    <span class="badge ${clipboardState.syncMode === "server" ? "badge-accent" : "badge-muted"}">${clipboardState.syncMode === "server" ? "Server" : "Local"}</span>
                </div>
                <div class="axis-clipboard-preview">
                    <div style="font-family: var(--font-mono); font-size: 0.84rem; color: var(--text-main); line-height: 1.72; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; word-break: break-word;">${escapeHtml(latestClipboard)}</div>
                </div>
                <div class="axis-chip-row">
                    <button id="axis-open-clipboard-modal" type="button" class="tactical-btn" onclick="openClipboardModal()">Open</button>
                    <button type="button" class="tactical-btn" onclick="copyLatestClipboardItem()">Copy latest</button>
                </div>
            </div>
        </section>

        <section class="grid grid-cols-1" style="gap: 14px;">
            <div class="cockpit-card-flat stack stack-sm" style="padding: 18px; gap: 12px;">
                <div class="axis-panel-head" style="margin: 0;">
                    <div class="stack stack-sm" style="gap: 4px;">
                        <span class="axis-section-overline">Destiny</span>
                        <div style="font-size: 0.88rem; font-weight: 550; letter-spacing: -0.01em; color: var(--text-muted);">Rare events. Proof still required.</div>
                    </div>
                    <span class="badge ${destinyActive ? "badge-warning" : "badge-muted"}" style="font-size: 0.62rem;">+${todayTelemetry.destinyBonusPoints || 0}</span>
                </div>
                <form onsubmit="handleDestinySave(event)" class="stack stack-sm" style="gap: 8px;">
                    <div class="grid grid-cols-1 md-grid-cols-2" style="gap: 8px;">
                        <select class="tactical-select" style="min-height: 40px; padding: 10px 12px; font-size: 0.86rem;" onchange="updateDestinyDraft('tier', this.value)">
                            <option value="0" ${Number(coreDataState.draftDestinyTier) === 0 ? "selected" : ""}>Tier 0</option>
                            <option value="1" ${Number(coreDataState.draftDestinyTier) === 1 ? "selected" : ""}>Tier 1</option>
                            <option value="2" ${Number(coreDataState.draftDestinyTier) === 2 ? "selected" : ""}>Tier 2</option>
                            <option value="3" ${Number(coreDataState.draftDestinyTier) === 3 ? "selected" : ""}>Tier 3</option>
                            <option value="4" ${Number(coreDataState.draftDestinyTier) === 4 ? "selected" : ""}>Tier 4</option>
                        </select>
                        <input class="tactical-input" style="min-height: 40px; padding: 10px 12px; font-size: 0.86rem;" placeholder="Bonus override (optional)" value="${escapeHtml(coreDataState.draftDestinyBonus || "")}" oninput="updateDestinyDraft('bonus', this.value)">
                    </div>
                    <input class="tactical-input" style="min-height: 40px; padding: 10px 12px; font-size: 0.86rem;" placeholder="Destiny title" value="${escapeHtml(coreDataState.draftDestinyTitle || "")}" oninput="updateDestinyDraft('title', this.value)">
                    <input class="tactical-input" style="min-height: 40px; padding: 10px 12px; font-size: 0.86rem;" placeholder="Proof URL (required for tier 2+)" value="${escapeHtml(coreDataState.draftDestinyProofUrl || "")}" oninput="updateDestinyDraft('proof', this.value)">
                    <div class="axis-chip-row">
                        <button type="submit" class="tactical-btn" style="padding: 7px 12px; font-size: 0.7rem; min-height: 34px;">Save</button>
                        <button type="button" class="tactical-btn" style="padding: 7px 12px; font-size: 0.7rem; min-height: 34px;" onclick="clearDestinyEvent()">Clear</button>
                        ${todayTelemetry.destinyTitle ? `<span class="badge badge-accent" style="font-size: 0.62rem;">${escapeHtml(todayTelemetry.destinyTitle)}</span>` : ""}
                    </div>
                </form>
            </div>
        </section>
    `;
}

function renderWeeklyReviewHTML() {
  const review = coreDataState.review;
  const momentum = coreDataState.momentum || {
    totalCurrent: 0,
    totalLongest: 0,
  };
  if (!review?.metrics) {
    return `<div class="axis-quiet-note">Weekly review loads after sync.</div>`;
  }

  return `
        <div class="axis-review-grid">
            <div class="axis-review-card"><span>Tasks</span><strong>${review.metrics.tasksCompleted}</strong><em>${formatDeltaStat(review.metrics.tasksDelta)}</em></div>
            <div class="axis-review-card"><span>Workouts</span><strong>${review.metrics.workouts}</strong><em>${formatDeltaStat(review.metrics.workoutsDelta)}</em></div>
            <div class="axis-review-card"><span>Protein days</span><strong>${review.metrics.proteinHitDays}/7</strong><em>${formatDeltaStat(review.metrics.proteinHitDelta)}</em></div>
            <div class="axis-review-card"><span>Sleep avg</span><strong>${review.metrics.avgSleep}h</strong><em>${formatDeltaStat(review.metrics.avgSleepDelta, "h")}</em></div>
            <div class="axis-review-card"><span>Score avg</span><strong>${review.metrics.avgScore}</strong><em>${formatDeltaStat(review.metrics.avgScoreDelta)}</em></div>
            <div class="axis-review-card"><span>Outside</span><strong>${review.metrics.outsideDays}/7</strong><em>${formatDeltaStat(review.metrics.outsideDelta)}</em></div>
        </div>
        <div class="axis-chip-row">
            <span class="badge badge-muted">Momentum ${momentum.taskTotals?.currentBest || momentum.totalCurrent || 0}d</span>
            <span class="badge badge-muted">Longest ${momentum.taskTotals?.longestBest || momentum.totalLongest || 0}d</span>
            <span class="badge badge-muted">Farming ${(Number(todayTelemetry.farmingRatioV4 || 0) * 100).toFixed(0)}%</span>
            <span class="badge ${todayTelemetry.mustWinDoneV4 ? "badge-optimal" : "badge-warning"}">${todayTelemetry.mustWinDoneV4 ? "Must-win landed" : "Must-win missing"}</span>
        </div>
        <div class="axis-muted-caption">Avg score still uses the legacy weekly row until weekly V4 rollup gets its own backend summary. Daily V4 scoring is already live.</div>
    `;
}

function renderMarkerCalendarHTML() {
  const slots = coreDataState.review?.markerCalendar || [];
  if (!slots.length) return "";
  return `<div class="axis-mini-calendar">${slots
    .map((slot) => {
      const [y, m, d] = String(slot.dayKey || "").split("-");
      const items = slot.items || [];
      const preview = items[0]?.title
        ? escapeHtml(items[0].title)
        : "No markers";
      const titleText = items.length
        ? escapeHtml(items.map((item) => item.title).join(" • "))
        : "No markers";
      return `<div class="axis-mini-day ${slot.status === "today" ? "today" : ""}" title="${titleText}">
            <div class="axis-mini-day-date">${d}/${m}</div>
            ${items.length ? `<span class="axis-mini-day-count">${items.length} marker${items.length > 1 ? "s" : ""}</span>` : `<span class="axis-mini-day-count" style="opacity:.45;">empty</span>`}
            <div class="axis-mini-day-preview">${preview}</div>
        </div>`;
    })
    .join("")}</div>`;
}

function renderMarkerListHTML() {
  const markers = (coreDataState.markers || []).slice(0, 8);
  if (!markers.length) {
    return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 16px;">No markers yet.</div>`;
  }
  return markers
    .map(
      (marker) => `
        <div class="list-item" style="align-items: flex-start; gap: 12px; opacity: ${marker.is_done ? "0.6" : "1"};">
            <button type="button" onclick="toggleMarkerItem('${marker.id}', ${!marker.is_done})" style="width: 22px; height: 22px; border-radius: 999px; border: 1.5px solid ${marker.is_done ? "var(--hud-violet)" : "rgba(255,255,255,0.18)"}; background: ${marker.is_done ? "rgba(215,154,82,0.14)" : "transparent"}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer;"><span style="width: 10px; height: 10px; border-radius: 999px; background: ${marker.is_done ? "var(--hud-violet)" : "transparent"}; display: block;"></span></button>
            <div class="flex-1" style="min-width: 0;">
                <div class="font-mono text-sm font-bold text-main">${escapeHtml(marker.title)}</div>
                <div class="text-sm text-muted" style="margin-top: 4px;">${marker.target_date} • ${(marker.marker_type || "deadline").toUpperCase()}</div>
                ${marker.note ? `<div class="text-sm text-muted" style="margin-top: 4px; line-height: 1.5;">${escapeHtml(marker.note)}</div>` : ""}
            </div>
            <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem;" onclick="deleteMarkerItem('${marker.id}')">Del</button>
        </div>
    `,
    )
    .join("");
}

function renderClipboardModalHTML() {
  if (!clipboardState.modalOpen) return "";
  return `
        <div id="axis-clipboard-modal" class="axis-modal-shell" onclick="axisModals.backdropClose(event, 'clipboard')">
            <div id="axis-clipboard-panel" class="cockpit-card axis-modal-panel axis-modal-panel-clipboard">
                <div class="row" style="justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <span class="font-mono text-base font-semibold text-accent">CLIPBOARD</span>
                    <button type="button" class="tactical-btn" onclick="closeClipboardModal()">Close</button>
                </div>
                <form onsubmit="handleClipboardSave(event)" class="stack stack-sm">
                    <textarea id="axis-clipboard-input" class="tactical-input" rows="6" placeholder="Paste notes or TTS text here..." style="resize: vertical; line-height: 1.6; min-height: 160px;" onfocus="setClipboardEditing(true)" onblur="setClipboardEditing(false)" oninput="updateClipboardDraft(this.value)">${escapeHtml(clipboardState.draft || "")}</textarea>
                    <div class="row flex-wrap" style="gap: 8px;">
                        <button type="submit" class="tactical-btn">Save</button>
                        <button type="button" class="tactical-btn" onclick="copyLatestClipboardItem()">Copy latest</button>
                        <button type="button" class="tactical-btn" onclick="resetClipboardItems()">Clear</button>
                    </div>
                </form>
                <div class="divider"></div>
                <div class="stack stack-sm axis-modal-body">${renderClipboardHistoryHTML()}</div>
            </div>
        </div>
    `;
}

function renderTaskCaptureModalHTML() {
  if (!coreDataState.taskModalOpen) return "";
  return `
        <div id="axis-task-modal" class="axis-modal-shell" onclick="axisModals.backdropClose(event, 'task')">
            <div id="axis-task-panel" class="cockpit-card axis-modal-panel axis-modal-panel-task">
                <div class="axis-panel-head">
                    <div class="stack stack-sm" style="gap: 6px;">
                        <span class="axis-section-overline">Capture</span>
                        <div style="font-size: 1.1rem; font-weight: 650; letter-spacing: -0.02em;">Commit the work clearly.</div>
                    </div>
                    <button type="button" class="tactical-btn" onclick="closeTaskModal()">Close</button>
                </div>
                <div class="axis-modal-body">
                    <div class="axis-quiet-note" style="margin-bottom: 14px;">Morning commit lock runs 06:00–10:00 Cairo. After that, new tasks are 0pt unless incoming critical is on.</div>
                    ${renderTaskCaptureFormHTML()}
                </div>
            </div>
        </div>
    `;
}

function renderTodoListHTML(items = coreDataState.todos) {
  if (!items.length) {
    return `<div class="axis-quiet-note">Nothing here yet.</div>`;
  }
  return items
    .slice(0, 24)
    .map((todo) => {
      const momentumEntry = getTaskMomentumEntry(todo);
      const streakDays = Number(momentumEntry?.currentStreak || 0);
      const streakTier = getMomentumTierClass(
        momentumEntry?.tier?.key || "none",
      );
      const streakBadge =
        streakDays > 0
          ? `<span class="badge badge-cyan axis-streak-badge axis-streak-${streakTier}">${escapeHtml(momentumEntry?.tier?.label || "STREAK")} • ${streakDays}d</span>`
          : "";
      return `
        <div class="list-item axis-task-row" style="opacity: ${todo.pending ? "0.72" : "1"};">
            <button type="button" aria-label="toggle task" class="axis-check-btn axis-check-streak-${streakTier}" onclick="toggleTodoItem('${todo.id}', ${!todo.is_done})" style="border-color: ${todo.is_done ? "rgba(247,244,238,0.22)" : "rgba(255,255,255,0.12)"}; background: ${todo.is_done ? "rgba(247,244,238,0.12)" : "transparent"};">
                <span class="axis-check-dot" style="background: ${todo.is_done ? "var(--text-main)" : "transparent"};"></span>
            </button>
            <div class="flex-1" style="min-width: 0;">
                <div class="axis-task-topline">
                    <div class="axis-task-title" style="color: ${todo.is_done ? "var(--text-muted)" : "var(--text-main)"}; text-decoration: ${todo.is_done ? "line-through" : "none"};">${escapeHtml(todo.title)}</div>
                    <div class="axis-chip-row">
                        ${streakBadge}
                        <span class="badge badge-muted">${todo.is_done ? "Done" : "Committed"}</span>
                    </div>
                </div>
                <div class="axis-chip-row" style="margin-top: 8px;">
                    <span class="badge ${todo.task_kind === "ritual" ? "badge-cyan" : "badge-accent"}">${todo.task_kind === "ritual" ? "Ritual" : formatModeLabel(todo.mode || "desk")}</span>
                    <span class="badge badge-muted">Auto ${Number(todo.points_auto || todo.points || 0)}pt</span>
                    <span class="badge badge-muted">Use ${Number(todo.points || 0)}pt</span>
                    ${todo.must_win ? `<span class="badge badge-warning">Must-win</span>` : ""}
                    ${todo.depth ? `<span class="badge badge-muted">Deep</span>` : ""}
                    ${todo.pending ? `<span class="badge badge-muted">Syncing</span>` : ""}
                </div>
                ${todo.done_definition ? `<div class="axis-task-detail">Done = ${escapeHtml(todo.done_definition)}</div>` : ""}
                ${
                  todo.task_kind === "ritual"
                    ? `<div class="axis-task-detail">Ritual streak ${momentumEntry?.currentStreak || 0}d • longest ${momentumEntry?.longestStreak || 0}d</div>`
                    : `<div class="axis-task-detail">Impact ${todo.impact || 1} • Resistance ${todo.resistance || 1} • Depth ${todo.depth || 0}${momentumEntry ? ` • streak ${momentumEntry.currentStreak}d / longest ${momentumEntry.longestStreak}d` : ""}</div>`
                }
            </div>
            <button type="button" class="tactical-btn" style="padding: 4px 8px; font-size: 0.62rem; flex-shrink: 0;" onclick="deleteTodoItem('${todo.id}')">Del</button>
        </div>
    `;
    })
    .join("");
}

function renderClipboardHistoryHTML() {
  if (!clipboardState.items.length) {
    return `<div class="text-sm text-muted font-mono" style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px;">No items yet.</div>`;
  }
  return clipboardState.items
    .slice(0, 6)
    .map(
      (item) => `
        <div class="list-item" style="border-left: 3px solid var(--hud-violet); gap: 10px; align-items: start;">
            <div class="flex-1" style="min-width: 0;">
                <div style="font-size: 0.82rem; color: var(--text-main); line-height: 1.55; white-space: pre-wrap; word-break: break-word; user-select: text;">${escapeHtml(item.content)}</div>
                <div style="font-size: 0.66rem; color: var(--text-muted); margin-top: 4px;">${item.source || "axis"} • ${formatClipboardTime(item.created_at || item.timestamp)}</div>
            </div>
            <button class="tactical-btn" style="padding: 4px 10px; font-size: 0.64rem; flex-shrink: 0;" onclick="copyClipboardByIndex(${item.__idx})">Copy</button>
            <button class="tactical-btn" style="padding: 4px 8px; font-size: 0.6rem; flex-shrink: 0;" onclick="deleteClipboardItem('${item.id}')">Del</button>
        </div>
    `,
    )
    .join("");
}

function persistCoreDataSnapshot() {
  localStorage.setItem(
    "axis_core_balance",
    JSON.stringify(coreDataState.balance),
  );
  localStorage.setItem("axis_core_todos", JSON.stringify(coreDataState.todos));
  localStorage.setItem(
    "axis_core_markers",
    JSON.stringify(coreDataState.markers || []),
  );
}

function setCoreSyncVisual(state = "quiet", detail = "") {
  if (typeof setAxisSyncState === "function") {
    setAxisSyncState(state, detail);
  }
}

function shouldUseClipboardServer() {
  return !!(
    window.axisAuthState?.authenticated &&
    typeof supabaseClient !== "undefined" &&
    supabaseClient.mode === "online"
  );
}

function shouldUseDailyServer() {
  return !!(
    window.axisAuthState?.authenticated &&
    typeof supabaseClient !== "undefined" &&
    supabaseClient.mode === "online"
  );
}

async function loadDailyFromServer({ silent = false } = {}) {
  if (!shouldUseDailyServer()) return false;
  try {
    const resp = await fetch("/api/daily", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    const row = data.row || {};
    todayTelemetry.gymLogged = !!row.gym_logged;
    todayTelemetry.gymSplit = row.gym_split_name || "None";
    todayTelemetry.designHours = Number(row.design_hours || 0);
    todayTelemetry.sleepHours = Number(row.sleep_hours || 0);
    todayTelemetry.waterLiters = Number(row.water_liters || 0);
    todayTelemetry.wentOutside = !!row.went_outside;
    todayTelemetry.watchedTutorial = !!row.watched_tutorial;
    todayTelemetry.lastLoggedTimestamp = Date.now();
    todayTelemetry.fitnessScoreV4 = Number(row.fitness_score_v4 || 0);
    todayTelemetry.nutritionScoreV4 = Number(row.nutrition_score_v4 || 0);
    todayTelemetry.sleepScoreV4 = Number(row.sleep_score_v4 || 0);
    todayTelemetry.readingScoreV4 = Number(row.reading_score_v4 || 0);
    todayTelemetry.destinyTier = Number(row.destiny_tier || 0);
    todayTelemetry.destinyTitle = String(row.destiny_title || "");
    todayTelemetry.destinyBonusPoints = Number(row.destiny_bonus_points || 0);
    todayTelemetry.destinyProofUrl = String(row.destiny_proof_url || "");
    todayTelemetry.effortV4 = Number(row.effort_v4 || 0);
    todayTelemetry.dayScoreV4 = Number(row.day_score_v4 || 0);
    todayTelemetry.gradeV4 = String(row.grade_v4 || "ROT");
    todayTelemetry.primaryModeV4 = String(row.primary_mode_v4 || "desk");
    todayTelemetry.deskEffV4 = Number(row.desk_eff_v4 || 0);
    todayTelemetry.uniEffV4 = Number(row.uni_eff_v4 || 0);
    todayTelemetry.fieldEffV4 = Number(row.field_eff_v4 || 0);
    todayTelemetry.mustWinDoneV4 = !!row.must_win_done_v4;
    todayTelemetry.farmingRatioV4 = Number(row.farming_ratio_v4 || 0);
    todayTelemetry.ritualsDoneV4 = Number(row.rituals_done_v4 || 0);
    todayTelemetry.ritualsTotalV4 = Number(row.rituals_total_v4 || 0);
    todayTelemetry.ritualsCappedV4 = Number(row.rituals_capped_v4 || 0);
    todayTelemetry.gradeMetaV4 = row.grade_meta_v4 || {
      label: todayTelemetry.gradeV4,
      color: "#333333",
      desc: "",
    };
    localStorage.setItem(
      "axis_today_gym",
      todayTelemetry.gymLogged ? "true" : "false",
    );
    localStorage.setItem("axis_today_gym_split", todayTelemetry.gymSplit);
    localStorage.setItem("axis_today_design", todayTelemetry.designHours);
    localStorage.setItem("axis_today_sleep", todayTelemetry.sleepHours);
    localStorage.setItem("axis_today_water", todayTelemetry.waterLiters);
    localStorage.setItem(
      "axis_today_outside",
      todayTelemetry.wentOutside ? "true" : "false",
    );
    localStorage.setItem(
      "axis_today_tutorial",
      todayTelemetry.watchedTutorial ? "true" : "false",
    );
    if (!(silent && coreEditingActive())) renderCoreHome();
    return true;
  } catch (e) {
    console.warn("Daily telemetry load failed:", e.message || e);
    return false;
  }
}

function applyLocalDailyAction(action, payload = {}) {
  switch (action) {
    case "gym-quick":
      todayTelemetry.gymLogged = true;
      todayTelemetry.gymSplit = payload.split || "Quick Mark";
      break;
    case "design-add":
      todayTelemetry.designHours =
        Number(todayTelemetry.designHours || 0) + Number(payload.amount || 1);
      break;
    case "water-add":
      todayTelemetry.waterLiters = Number(
        (
          Number(todayTelemetry.waterLiters || 0) +
          Number(payload.amount || 0.6)
        ).toFixed(1),
      );
      break;
    case "outside-toggle":
      todayTelemetry.wentOutside = !todayTelemetry.wentOutside;
      break;
    case "tutorial-toggle":
      todayTelemetry.watchedTutorial = !todayTelemetry.watchedTutorial;
      break;
    case "reset-core":
      todayTelemetry.gymLogged = false;
      todayTelemetry.gymSplit = "None";
      todayTelemetry.designHours = 0;
      todayTelemetry.sleepHours = 0;
      todayTelemetry.waterLiters = 0;
      todayTelemetry.wentOutside = false;
      todayTelemetry.watchedTutorial = false;
      break;
  }
}

async function applyDailyQuickAction(action, payload = {}) {
  if (!shouldUseDailyServer()) {
    console.warn("Daily actions need server connection online.");
    return;
  }
  window.axisPendingDailyMutation = true;
  applyLocalDailyAction(action, payload);
  renderCoreHome();
  if (typeof renderNutritionView === "function") renderNutritionView();
  try {
    const resp = await fetch("/api/daily", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    await loadDailyFromServer({ silent: false });
    if (typeof renderNutritionView === "function") renderNutritionView();
    if (typeof renderFitnessView === "function") renderFitnessView();
  } catch (e) {
    await loadDailyFromServer({ silent: false });
    console.warn(`Daily action failed: ${e.message}`);
  } finally {
    window.axisPendingDailyMutation = false;
  }
}

async function loadClipboardFromServer({ silent = false } = {}) {
  if (!shouldUseClipboardServer()) return false;
  try {
    const resp = await fetch("/api/clipboard", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    clipboardState.items = (data.rows || []).map((row, idx) => ({
      ...row,
      __idx: idx,
    }));
    localStorage.setItem(
      "axis_clipboard_items",
      JSON.stringify(clipboardState.items),
    );
    clipboardState.syncMode = "server";
    clipboardState.lastError = "";
    if (!(silent && coreEditingActive())) renderCoreHome();
    return true;
  } catch (e) {
    clipboardState.syncMode = "local";
    clipboardState.lastError = e.message || "FAILED TO LOAD CLIPBOARD";
    return false;
  }
}

function openClipboardModal() {
  if (coreDataState.taskModalOpen) {
    coreDataState.taskModalOpen = false;
  }
  clipboardState.modalOpen = true;
  if (window.axisModals) {
    window.axisModals.open({
      modalId: 'clipboard',
      triggerEl: document.getElementById('axis-open-clipboard-modal'),
      html: renderClipboardModalHTML(),
      focusSelector: '#axis-clipboard-input'
    });
  } else {
    // Fallback if modals.js failed to load.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    renderCoreHome();
  }
}

function closeClipboardModal() {
  clipboardState.modalOpen = false;
  clipboardState.isEditing = false;
  if (window.axisModals) {
    window.axisModals.close({ restoreFocus: true });
  } else {
    document.documentElement.style.overflow = coreDataState.taskModalOpen
      ? "hidden"
      : "";
    document.body.style.overflow = coreDataState.taskModalOpen ? "hidden" : "";
    renderCoreHome();
  }
}

function handleClipboardBackdrop(e) {
  if (e?.target?.id === "axis-clipboard-modal") closeClipboardModal();
}

// Escape is now handled inside modals.js to avoid duplicate listeners.

async function handleClipboardSave(e) {
  e.preventDefault();
  const input = document.getElementById("axis-clipboard-input");
  const content = String(input?.value || "").trim();
  if (!content) return;

  const saved = await saveClipboardItem(content, "axis_web");
  if (!saved) {
    console.warn(
      `Clipboard save failed: ${clipboardState.lastError || "Unknown error"}`,
    );
    return;
  }
  clipboardState.draft = "";
  if (input) input.value = "";
  if (typeof refreshCoreView === "function") refreshCoreView();
}

async function saveClipboardItem(content, source = "axis_web") {
  if (shouldUseClipboardServer()) {
    try {
      const resp = await fetch("/api/clipboard", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, source }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok)
        throw new Error(data.error || `HTTP ${resp.status}`);
      await loadClipboardFromServer({ silent: false });
      return true;
    } catch (e) {
      clipboardState.syncMode = "local";
      clipboardState.lastError = e.message || "FAILED TO SAVE CLIPBOARD";
    }
  }

  const item = {
    id: "local-" + Date.now(),
    content,
    source,
    created_at: new Date().toISOString(),
  };
  clipboardState.items.unshift(item);
  clipboardState.items = clipboardState.items
    .slice(0, 20)
    .map((row, idx) => ({ ...row, __idx: idx }));
  localStorage.setItem(
    "axis_clipboard_items",
    JSON.stringify(clipboardState.items),
  );
  renderCoreHome();
  return true;
}

async function manualClipboardSync() {
  const ok = await loadClipboardFromServer({ silent: false });
  if (!ok)
    console.warn(
      `Clipboard sync failed: ${clipboardState.lastError || "Unknown error"}`,
    );
}

async function deleteClipboardItem(id) {
  try {
    const resp = await fetch("/api/clipboard", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    clipboardState.items = clipboardState.items
      .filter((item) => item.id !== id)
      .map((row, idx) => ({ ...row, __idx: idx }));
    renderCoreHome();
  } catch (e) {
    console.warn(`Clipboard delete failed: ${e.message}`);
  }
}

async function resetClipboardItems() {
  if (!confirm("Clear clipboard memory?")) return;

  if (shouldUseClipboardServer()) {
    try {
      const resp = await fetch("/api/clipboard", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok)
        throw new Error(data.error || `HTTP ${resp.status}`);
    } catch (e) {
      console.warn(`Clipboard clear failed: ${e.message}`);
      return;
    }
  }

  clipboardState.items = [];
  localStorage.setItem("axis_clipboard_items", JSON.stringify([]));
  renderCoreHome();
}

async function loadCoreDataFromServer({ silent = false } = {}) {
  if (
    !window.axisAuthState?.authenticated ||
    typeof supabaseClient === "undefined" ||
    supabaseClient.mode !== "online"
  )
    return false;
  try {
    const shouldIncludeReview =
      !silent ||
      document.getElementById("module-core")?.classList.contains("active") ||
      !coreDataState.review;
    const resp = await fetch(
      `/api/coredata${shouldIncludeReview ? "?review=1" : ""}`,
      { method: "GET", credentials: "same-origin", cache: "no-store" },
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.balance = data.balance || coreDataState.balance;
    coreDataState.todos = data.todos || [];
    coreDataState.markers = data.markers || [];
    coreDataState.momentum = data.momentum || coreDataState.momentum;
    coreDataState.review = data.review || coreDataState.review;
    coreDataState.syncMode = "server";
    coreDataState.lastError = "";
    localStorage.setItem(
      "axis_core_balance",
      JSON.stringify(coreDataState.balance),
    );
    localStorage.setItem(
      "axis_core_todos",
      JSON.stringify(coreDataState.todos),
    );
    localStorage.setItem(
      "axis_core_markers",
      JSON.stringify(coreDataState.markers || []),
    );
    if (!(silent && coreEditingActive())) renderCoreHome();
    return true;
  } catch (e) {
    coreDataState.syncMode = "local";
    coreDataState.lastError = e.message || "FAILED TO LOAD CORE DATA";
    return false;
  }
}

async function handleBalanceSave(e) {
  e.preventDefault();
  const label =
    String(coreDataState.balance.label || "Main Balance").trim() ||
    "Main Balance";
  const amount = Number(
    coreDataState.draftBalanceAmount || coreDataState.balance.amount || 0,
  );
  if (
    !window.axisAuthState?.authenticated ||
    typeof supabaseClient === "undefined" ||
    supabaseClient.mode !== "online"
  ) {
    console.warn("Core balance needs server connection online.");
    return;
  }

  const previous = { ...coreDataState.balance };
  coreDataState.balance = { ...coreDataState.balance, label, amount };
  coreDataState.draftBalanceAmount = "";
  persistCoreDataSnapshot();
  setCoreSyncVisual("busy");
  renderCoreHome();

  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "balance",
        id: coreDataState.balance.id,
        label,
        amount,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.balance = data.row || coreDataState.balance;
    coreDataState.isEditing = false;
    persistCoreDataSnapshot();
    setCoreSyncVisual("quiet");
    renderCoreHome();
  } catch (e) {
    coreDataState.balance = previous;
    persistCoreDataSnapshot();
    setCoreSyncVisual("warn", "Balance sync failed");
    renderCoreHome();
    console.warn(`Balance save failed: ${e.message}`);
  }
}

async function handleTodoAdd(e) {
  e.preventDefault();
  const title = String(coreDataState.draftTodo || "").trim();
  if (!title) return;
  if (
    !window.axisAuthState?.authenticated ||
    typeof supabaseClient === "undefined" ||
    supabaseClient.mode !== "online"
  ) {
    console.warn("Task add needs server connection online.");
    return;
  }

  const preview = getTaskDraftPreview();
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const optimisticRow = {
    id: tempId,
    title,
    is_done: false,
    is_daily: !!coreDataState.draftTodoIsDaily,
    task_kind: coreDataState.draftTaskKind,
    mode: coreDataState.draftTaskMode,
    impact: Number(coreDataState.draftTaskImpact || 1),
    resistance: Number(coreDataState.draftTaskResistance || 1),
    depth: Number(coreDataState.draftTaskDepth || 0),
    points_auto: preview.auto,
    points: preview.effective,
    must_win: preview.mustWin,
    done_definition: String(coreDataState.draftTaskDoneDefinition || "").trim(),
    status: "committed",
    incoming_critical: !!coreDataState.draftIncomingCritical,
    last_reset_key: currentAxisDayKeyClient(),
    completed_day_key: null,
    pending: true,
  };

  coreDataState.todos.unshift(optimisticRow);
  coreDataState.draftTodo = "";
  coreDataState.draftTodoIsDaily = false;
  coreDataState.draftTodoPoints = 1;
  coreDataState.draftTaskKind = "task";
  coreDataState.draftTaskMode = "desk";
  coreDataState.draftTaskImpact = 1;
  coreDataState.draftTaskResistance = 1;
  coreDataState.draftTaskDepth = 0;
  coreDataState.draftTaskDoneDefinition = "";
  coreDataState.draftIncomingCritical = false;
  coreDataState.isEditing = false;
  window.axisPendingCoreMutation = true;
  persistCoreDataSnapshot();
  setCoreSyncVisual("busy");
  renderCoreHome();

  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "todo-add",
        title,
        isDaily: optimisticRow.is_daily,
        points: optimisticRow.points,
        taskKind: optimisticRow.task_kind,
        mode: optimisticRow.mode,
        impact: optimisticRow.impact,
        resistance: optimisticRow.resistance,
        depth: optimisticRow.depth,
        doneDefinition: optimisticRow.done_definition,
        incomingCritical: optimisticRow.incoming_critical,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.todos = coreDataState.todos.map((todo) =>
      todo.id === tempId ? data.row : todo,
    );
    coreDataState.taskModalOpen = false;
    persistCoreDataSnapshot();
    await loadDailyFromServer({ silent: true });
    setCoreSyncVisual("quiet");
    if (window.axisModals) window.axisModals.close({ restoreFocus: true });
    renderCoreHome();
  } catch (e) {
    coreDataState.todos = coreDataState.todos.filter(
      (todo) => todo.id !== tempId,
    );
    coreDataState.draftTodo = title;
    persistCoreDataSnapshot();
    setCoreSyncVisual("warn", "Task sync failed");
    renderCoreHome();
    console.warn(`Todo add failed: ${e.message}`);
  } finally {
    window.axisPendingCoreMutation = false;
  }
}

async function toggleTodoItem(id, isDone) {
  if (
    !window.axisAuthState?.authenticated ||
    typeof supabaseClient === "undefined" ||
    supabaseClient.mode !== "online"
  ) {
    console.warn("Task toggle needs server connection online.");
    return;
  }

  const previousTodos = coreDataState.todos.map((todo) => ({ ...todo }));
  coreDataState.todos = coreDataState.todos.map((todo) =>
    todo.id === id
      ? {
          ...todo,
          is_done: !!isDone,
          completed_day_key: isDone ? currentAxisDayKeyClient() : null,
          last_reset_key: currentAxisDayKeyClient(),
          pending: true,
        }
      : todo,
  );
  window.axisPendingCoreMutation = true;
  persistCoreDataSnapshot();
  setCoreSyncVisual("busy");
  renderCoreHome();

  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "todo-toggle", id, isDone }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.todos = coreDataState.todos.map((todo) =>
      todo.id === id
        ? { ...todo, ...(data.row || {}), is_done: !!isDone, pending: false }
        : todo,
    );
    persistCoreDataSnapshot();
    await loadDailyFromServer({ silent: true });
    setCoreSyncVisual("quiet");
    renderCoreHome();
  } catch (e) {
    coreDataState.todos = previousTodos;
    persistCoreDataSnapshot();
    setCoreSyncVisual("warn", "Task sync failed");
    renderCoreHome();
    console.warn(`Todo update failed: ${e.message}`);
  } finally {
    window.axisPendingCoreMutation = false;
  }
}

async function deleteTodoItem(id) {
  if (
    !window.axisAuthState?.authenticated ||
    typeof supabaseClient === "undefined" ||
    supabaseClient.mode !== "online"
  ) {
    console.warn("Task delete needs server connection online.");
    return;
  }

  const previousTodos = coreDataState.todos.map((todo) => ({ ...todo }));
  coreDataState.todos = coreDataState.todos.filter((todo) => todo.id !== id);
  window.axisPendingCoreMutation = true;
  persistCoreDataSnapshot();
  setCoreSyncVisual("busy");
  renderCoreHome();

  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "todo-delete", id }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    persistCoreDataSnapshot();
    await loadDailyFromServer({ silent: true });
    setCoreSyncVisual("quiet");
    renderCoreHome();
  } catch (e) {
    coreDataState.todos = previousTodos;
    persistCoreDataSnapshot();
    setCoreSyncVisual("warn", "Task delete failed");
    renderCoreHome();
    console.warn(`Todo delete failed: ${e.message}`);
  } finally {
    window.axisPendingCoreMutation = false;
  }
}

async function clearDoneTodos() {
  if (
    !window.axisAuthState?.authenticated ||
    typeof supabaseClient === "undefined" ||
    supabaseClient.mode !== "online"
  ) {
    console.warn("Task clear needs server connection online.");
    return;
  }

  const previousTodos = coreDataState.todos.map((todo) => ({ ...todo }));
  coreDataState.todos = coreDataState.todos.filter((todo) => !todo.is_done);
  window.axisPendingCoreMutation = true;
  persistCoreDataSnapshot();
  setCoreSyncVisual("busy");
  renderCoreHome();

  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "todo-clear-done" }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    persistCoreDataSnapshot();
    await loadDailyFromServer({ silent: true });
    setCoreSyncVisual("quiet");
    renderCoreHome();
  } catch (e) {
    coreDataState.todos = previousTodos;
    persistCoreDataSnapshot();
    setCoreSyncVisual("warn", "Task clear failed");
    renderCoreHome();
    console.warn(`Todo clear failed: ${e.message}`);
  } finally {
    window.axisPendingCoreMutation = false;
  }
}

async function handleMarkerSave(e) {
  e.preventDefault();
  const title = String(coreDataState.draftMarkerTitle || "").trim();
  const targetDate = String(coreDataState.draftMarkerDate || "").trim();
  if (!title || !targetDate) return;
  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "marker-save",
        title,
        targetDate,
        markerType: coreDataState.draftMarkerType,
        note: coreDataState.draftMarkerNote,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.markers.push(data.row);
    coreDataState.markers.sort((a, b) =>
      String(a.target_date).localeCompare(String(b.target_date)),
    );
    coreDataState.draftMarkerTitle = "";
    coreDataState.draftMarkerDate = "";
    coreDataState.draftMarkerType = "deadline";
    coreDataState.draftMarkerNote = "";
    persistCoreDataSnapshot();
    await loadCoreDataFromServer({ silent: false });
    renderCoreHome();
  } catch (e) {
    console.warn(`Marker save failed: ${e.message}`);
  }
}

async function toggleMarkerItem(id, isDone) {
  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "marker-toggle", id, isDone }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.markers = coreDataState.markers.map((marker) =>
      marker.id === id
        ? { ...marker, ...(data.row || {}), is_done: !!isDone }
        : marker,
    );
    persistCoreDataSnapshot();
    await loadCoreDataFromServer({ silent: false });
    renderCoreHome();
  } catch (e) {
    console.warn(`Marker toggle failed: ${e.message}`);
  }
}

async function deleteMarkerItem(id) {
  try {
    const resp = await fetch("/api/coredata", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "marker-delete", id }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.markers = coreDataState.markers.filter(
      (marker) => marker.id !== id,
    );
    persistCoreDataSnapshot();
    await loadCoreDataFromServer({ silent: false });
    renderCoreHome();
  } catch (e) {
    console.warn(`Marker delete failed: ${e.message}`);
  }
}

function updateMarkerDraft(field, value) {
  coreDataState.isEditing = true;
  if (field === "title") coreDataState.draftMarkerTitle = String(value || "");
  if (field === "date") coreDataState.draftMarkerDate = String(value || "");
  if (field === "type")
    coreDataState.draftMarkerType = String(value || "deadline");
  if (field === "note") coreDataState.draftMarkerNote = String(value || "");
}

function openTaskModal() {
  if (clipboardState.modalOpen) {
    clipboardState.modalOpen = false;
    clipboardState.isEditing = false;
  }
  coreDataState.taskModalOpen = true;
  coreDataState.isEditing = true;
  if (window.axisModals) {
    window.axisModals.open({
      modalId: 'task',
      triggerEl: document.getElementById('axis-open-task-modal'),
      html: renderTaskCaptureModalHTML(),
      focusSelector: '#axis-todo-input'
    });
  } else {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    renderCoreHome();
  }
}

function closeTaskModal() {
  coreDataState.taskModalOpen = false;
  coreDataState.isEditing = false;
  if (window.axisModals) {
    window.axisModals.close({ restoreFocus: true });
  } else {
    document.documentElement.style.overflow = clipboardState.modalOpen
      ? "hidden"
      : "";
    document.body.style.overflow = clipboardState.modalOpen ? "hidden" : "";
    renderCoreHome();
  }
}

function handleTaskModalBackdrop(e) {
  if (e?.target?.id === "axis-task-modal") closeTaskModal();
}

async function copyLatestClipboardItem() {
  if (!clipboardState.items.length) return;
  await copyTextToClipboard(clipboardState.items[0].content);
}

async function copyClipboardByIndex(index) {
  const item = clipboardState.items[index];
  if (!item) return;
  await copyTextToClipboard(item.content);
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

function formatClipboardTime(value) {
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${h}:${m}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setClipboardEditing(flag) {
  clipboardState.isEditing = !!flag;
}

function updateClipboardDraft(value) {
  clipboardState.draft = String(value || "");
  clipboardState.isEditing = true;
}

function setCoreDataEditing(flag) {
  coreDataState.isEditing = !!flag;
}

function updateBalanceDraft(type, value) {
  coreDataState.isEditing = true;
  if (type === "label") coreDataState.draftBalanceLabel = String(value || "");
  if (type === "amount") coreDataState.draftBalanceAmount = String(value || "");
}

function updateTodoDraft(value) {
  coreDataState.isEditing = true;
  coreDataState.draftTodo = String(value || "");
}

function updateTodoDaily(value) {
  coreDataState.isEditing = true;
  coreDataState.draftTodoIsDaily = !!value;
  renderCoreHome();
}

function updateTodoPoints(value) {
  coreDataState.isEditing = true;
  coreDataState.draftTodoPoints = Math.max(0, parseInt(value || 0, 10) || 0);
}

function updateTaskDraftMeta(field, value) {
  coreDataState.isEditing = true;
  if (field === "kind") coreDataState.draftTaskKind = String(value || "task");
  if (field === "mode") coreDataState.draftTaskMode = String(value || "desk");
  if (field === "impact")
    coreDataState.draftTaskImpact = parseInt(value || 1, 10) || 1;
  if (field === "resistance")
    coreDataState.draftTaskResistance = parseInt(value || 1, 10) || 1;
  if (field === "depth")
    coreDataState.draftTaskDepth = parseInt(value || 0, 10) || 0;
  if (field === "doneDefinition")
    coreDataState.draftTaskDoneDefinition = String(value || "");
  if (field === "incomingCritical")
    coreDataState.draftIncomingCritical = !!value;
  if (field !== "doneDefinition") renderCoreHome();
}

function updateDestinyDraft(field, value) {
  coreDataState.isEditing = true;
  if (field === "tier")
    coreDataState.draftDestinyTier = parseInt(value || 0, 10) || 0;
  if (field === "title") coreDataState.draftDestinyTitle = String(value || "");
  if (field === "proof")
    coreDataState.draftDestinyProofUrl = String(value || "");
  if (field === "bonus") coreDataState.draftDestinyBonus = String(value || "");
}

async function handleDestinySave(e) {
  e.preventDefault();
  try {
    const resp = await fetch("/api/daily", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "destiny-set",
        tier: coreDataState.draftDestinyTier,
        title: coreDataState.draftDestinyTitle,
        proofUrl: coreDataState.draftDestinyProofUrl,
        bonusPoints: coreDataState.draftDestinyBonus,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    await loadDailyFromServer({ silent: false });
  } catch (e) {
    console.warn(`Destiny save failed: ${e.message}`);
  }
}

async function clearDestinyEvent() {
  try {
    const resp = await fetch("/api/daily", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "destiny-clear" }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok)
      throw new Error(data.error || `HTTP ${resp.status}`);
    coreDataState.draftDestinyTier = 0;
    coreDataState.draftDestinyTitle = "";
    coreDataState.draftDestinyProofUrl = "";
    coreDataState.draftDestinyBonus = "";
    await loadDailyFromServer({ silent: false });
  } catch (e) {
    console.warn(`Destiny clear failed: ${e.message}`);
  }
}

function computeAndDisplayScore() {
  renderCoreHome();
}

function coreEditingActive() {
  const coreEl = document.getElementById("module-core");
  const activeCore = coreEl?.classList.contains("active");
  if (!activeCore) return false;
  if (clipboardState.modalOpen || coreDataState.taskModalOpen) return true;
  if (clipboardState.isEditing || coreDataState.isEditing) return true;
  const el = document.activeElement;
  if (!el) return false;
  return (
    coreEl?.contains(el) && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
}

function refreshCoreView() {
  if (coreEditingActive()) return;
  renderCoreHome();
}

function injectQuickTelemetry(type) {
  todayTelemetry.lastLoggedTimestamp = Date.now();
  localStorage.setItem(
    "axis_last_logged_time",
    todayTelemetry.lastLoggedTimestamp,
  );

  if (type === "gym") {
    todayTelemetry.gymLogged = true;
    todayTelemetry.gymSplit = "Chest + Back";
    localStorage.setItem("axis_today_gym", "true");
    localStorage.setItem("axis_today_gym_split", "Chest + Back");
  } else if (type === "design") {
    todayTelemetry.designHours = Math.min(10, todayTelemetry.designHours + 2);
    localStorage.setItem("axis_today_design", todayTelemetry.designHours);
  } else if (type === "water") {
    todayTelemetry.waterLiters = parseFloat(
      (todayTelemetry.waterLiters + 0.6).toFixed(1),
    );
    localStorage.setItem("axis_today_water", todayTelemetry.waterLiters);
    if (typeof refreshFitnessWater === "function") refreshFitnessWater();
    if (typeof renderNutritionView === "function") renderNutritionView();
  } else if (type === "outside") {
    todayTelemetry.wentOutside = true;
    localStorage.setItem("axis_today_outside", "true");
  } else if (type === "reset") {
    todayTelemetry.gymLogged = false;
    todayTelemetry.gymSplit = "None";
    todayTelemetry.designHours = 0;
    todayTelemetry.waterLiters = 0;
    todayTelemetry.sleepHours = 0;
    todayTelemetry.wentOutside = false;
    todayTelemetry.watchedTutorial = false;
    todayTelemetry.lastLoggedTimestamp = 0;
    localStorage.clear();
  }

  renderCoreHome();
}
