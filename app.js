// ===== CONFIG =====
const DAILY_GOAL = 3500;
const STORAGE_KEY = "hydrationData";
const HISTORY_KEY = "hydrationHistory";
const START_HOUR = 8;
const END_HOUR = 21.5;
const GRACE_MINUTES = 15;

// GitHub trigger
const GH_TRIGGER_TOKEN = "PASTE_YOUR_GITHUB_TRIGGER_TOKEN_HERE";
const GH_REPO = "bhanutejallu-prog/hydratrack";

// ===== ELEMENTS =====
const intakeEl = document.getElementById("intake");
const percentEl = document.getElementById("percentage");
const circle = document.getElementById("circleProgress");
const buttons = document.querySelectorAll("button[data-amount]");
const scheduleList = document.getElementById("scheduleList");
const nextReminderEl = document.getElementById("nextReminder");

// ===== HELPERS =====
function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function trigger(event) {
  fetch(`https://api.github.com/repos/${GH_REPO}/dispatches`, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${GH_TRIGGER_TOKEN}`
    },
    body: JSON.stringify({ event_type: event })
  });
}

// ===== STORAGE =====
function loadData() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!saved || saved.date !== todayKey()) {
    return {
      date: todayKey(),
      intake: 0,
      reminders: generateReminders(),
      sent: { p25:false, p50:false, p75:false, goal:false }
    };
  }
  return saved;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== HISTORY =====
function saveDailyHistory(date, intake) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
  history[date] = intake;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ===== REMINDERS =====
function generateReminders() {
  const list = [];
  const total = (END_HOUR - START_HOUR) * 60;
  const sessions = Math.ceil(DAILY_GOAL / 300);
  const gap = Math.floor(total / sessions);
  let time = START_HOUR * 60;

  for (let i = 0; i < sessions; i++) {
    list.push({ time, done:false, missed:false });
    time += gap;
  }
  return list;
}

// ===== UI =====
function updateUI(data) {
  intakeEl.textContent = `${data.intake} ml`;
  const pct = Math.min((data.intake / DAILY_GOAL) * 100, 100);
  percentEl.textContent = `${Math.round(pct)}%`;
  circle.style.strokeDashoffset = 440 - (pct / 100) * 440;

  scheduleList.innerHTML = "";
  let next = null;
  data.reminders.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${r.time}</span><span>${r.done ? "Done" : r.missed ? "Missed" : "Upcoming"}</span>`;
    scheduleList.appendChild(li);
    if (!r.done && !r.missed && !next) next = r;
  });
  nextReminderEl.textContent = next ? "Upcoming" : "Done 🎉";
}

// ===== MAIN =====
let data = loadData();
updateUI(data);

// Buttons
buttons.forEach(btn => {
  btn.onclick = () => {
    const amt = Number(btn.dataset.amount);
    data.intake = Math.min(data.intake + amt, DAILY_GOAL);

    const next = data.reminders.find(r => !r.done && !r.missed);
    if (next) next.done = true;

    const pct = (data.intake / DAILY_GOAL) * 100;

    if (pct >= 25 && !data.sent.p25) { trigger("progress_25"); data.sent.p25 = true; }
    if (pct >= 50 && !data.sent.p50) { trigger("progress_50"); data.sent.p50 = true; }
    if (pct >= 75 && !data.sent.p75) { trigger("progress_75"); data.sent.p75 = true; }
    if (pct >= 100 && !data.sent.goal) { trigger("goal_completed"); data.sent.goal = true; }

    saveData(data);
    updateUI(data);
  };
});

// ===== SMART REMINDERS =====
setInterval(() => {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  data.reminders.forEach(r => {
    if (!r.done && !r.missed && mins > r.time + GRACE_MINUTES) {
      r.missed = true;
      trigger("missed_alert");

      // Smart follow-up reminder after 10 min
      setTimeout(() => trigger("smart_reminder"), 10 * 60 * 1000);
    }
  });

  saveData(data);
  updateUI(data);
}, 60000);

// ===== DAILY & WEEKLY SUMMARY =====
setInterval(() => {
  if (data.date !== todayKey()) {
    saveDailyHistory(data.date, data.intake);

    const history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
    const days = Object.keys(history).slice(-7);

    if (days.length === 7) {
      trigger("weekly_summary");
    }

    trigger("night_summary");
    data = loadData();
    saveData(data);
    updateUI(data);
  }
}, 60000);
