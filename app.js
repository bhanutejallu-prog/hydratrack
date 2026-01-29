// ===== CONFIG =====
const APP_VERSION = "v2"; // 🔴 CHANGE THIS IF YOU MODIFY LOGIC AGAIN
const DAILY_GOAL = 3500;
const STORAGE_KEY = "hydrationData";
const VERSION_KEY = "hydrationVersion";
const START_HOUR = 8;
const END_HOUR = 21.5;
const GRACE_MINUTES = 15;

// ===== ELEMENTS =====
const intakeEl = document.getElementById("intake");
const percentEl = document.getElementById("percentage");
const circle = document.getElementById("circleProgress");
const buttons = document.querySelectorAll("button[data-amount]");
const scheduleList = document.getElementById("scheduleList");
const nextReminderEl = document.getElementById("nextReminder");

// ===== CIRCLE =====
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
circle.style.strokeDasharray = CIRCUMFERENCE;

// ===== HELPERS =====
function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = h % 12 || 12;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ===== STORAGE RESET (AUTO FIX) =====
(function versionCheck() {
  const savedVersion = localStorage.getItem(VERSION_KEY);
  if (savedVersion !== APP_VERSION) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  }
})();

// ===== STORAGE =====
function loadData() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!saved || saved.date !== todayKey()) {
    return {
      date: todayKey(),
      intake: 0,
      reminders: generateReminders()
    };
  }
  return saved;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== REMINDER GENERATION =====
function generateReminders() {
  const reminders = [];
  const totalMinutes = (END_HOUR - START_HOUR) * 60;
  const sessions = Math.ceil(DAILY_GOAL / 300);
  const gap = Math.floor(totalMinutes / sessions);
  let time = START_HOUR * 60;

  for (let i = 0; i < sessions; i++) {
    reminders.push({
      time,
      done: false,
      missed: false
    });
    time += gap;
  }
  return reminders;
}

// ===== UI UPDATE =====
function updateUI(data) {
  intakeEl.textContent = `${data.intake} ml`;
  const percent = Math.min((data.intake / DAILY_GOAL) * 100, 100);
  percentEl.textContent = `${Math.round(percent)}%`;
  circle.style.strokeDashoffset =
    CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

  scheduleList.innerHTML = "";
  let next = null;

  data.reminders.forEach(r => {
    const li = document.createElement("li");
    const status = r.done ? "Done ✅" : r.missed ? "Missed ❌" : "Upcoming";
    li.innerHTML = `
      <span>${minutesToTime(r.time)}</span>
      <span>${status}</span>
    `;
    scheduleList.appendChild(li);

    if (!r.done && !r.missed && !next) next = r;
  });

  nextReminderEl.textContent = next
    ? minutesToTime(next.time)
    : "No more reminders today 🎉";
}

// ===== MAIN =====
let data = loadData();
updateUI(data);

// ===== BUTTON ACTIONS =====
buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const amt = Number(btn.dataset.amount);
    data.intake = Math.min(data.intake + amt, DAILY_GOAL);

    const next = data.reminders.find(r => !r.done && !r.missed);
    if (next) next.done = true;

    saveData(data);
    updateUI(data);
  });
});

// ===== REMINDER CHECK LOOP =====
setInterval(() => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  data.reminders.forEach(r => {
    if (
      !r.done &&
      !r.missed &&
      currentMinutes > r.time + GRACE_MINUTES &&
      currentMinutes - r.time < 180 // only recent reminders
    ) {
      r.missed = true;
    }
  });

  if (data.date !== todayKey()) {
    data = {
      date: todayKey(),
      intake: 0,
      reminders: generateReminders()
    };
  }

  saveData(data);
  updateUI(data);
}, 60 * 1000);
