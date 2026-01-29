// ===== CONFIG =====
const DAILY_GOAL = 3500;
const STORAGE_KEY = "hydrationData";
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
const notifyBtn = document.getElementById("enableNotify");

// ===== SERVICE WORKER =====
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// ===== NOTIFICATION PERMISSION =====
if ("Notification" in window) {
  if (Notification.permission === "default") {
    notifyBtn.style.display = "block";
    notifyBtn.onclick = async () => {
      const res = await Notification.requestPermission();
      if (res === "granted") notifyBtn.style.display = "none";
    };
  }
}

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
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}

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

    let status = "Upcoming";
    if (r.done) status = "Done ✅";
    else if (r.missed) status = "Missed ❌";

    li.innerHTML = `
      <span>${minutesToTime(r.time)}</span>
      <span>${status}</span>
    `;
    scheduleList.appendChild(li);

    if (!r.done && !r.missed && next === null) {
      next = r;
    }
  });

  nextReminderEl.textContent = next
    ? minutesToTime(next.time)
    : "All done for today 🎉";
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
      amount: 300,
      done: false,
      missed: false,
      notified: false
    });
    time += gap;
  }
  return reminders;
}

// ===== CHECK & NOTIFY =====
function checkReminders(data) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  data.reminders.forEach(r => {
    // Notification trigger (safe window)
    if (
      !r.done &&
      !r.notified &&
      currentMinutes >= r.time &&
      currentMinutes < r.time + 1 &&
      Notification.permission === "granted"
    ) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification("HydraTrack 💧", {
          body: `Time to drink ${r.amount} ml water`,
          icon: "icon.png"
        });
      });
      r.notified = true;
    }

    // Mark missed
    if (
      !r.done &&
      !r.missed &&
      currentMinutes > r.time + GRACE_MINUTES
    ) {
      r.missed = true;
    }
  });

  saveData(data);
  updateUI(data);
}
function saveDailyHistory(date, intake) {
  const history =
    JSON.parse(localStorage.getItem("hydrationHistory")) || {};
  history[date] = intake;
  localStorage.setItem("hydrationHistory", JSON.stringify(history));
}

// ===== MAIN =====
let data = loadData();

// SAFETY CHECK
if (!data.reminders || data.reminders.length === 0) {
  data.reminders = generateReminders();
  saveData(data);
}

// IMPORTANT: run immediately
checkReminders(data);
updateUI(data);

// Button actions
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

// Every minute check
setInterval(() => {
 if (data.date !== todayKey()) {
  saveDailyHistory(data.date, data.intake); // 👈 ADD THIS

  data = {
    date: todayKey(),
    intake: 0,
    reminders: generateReminders()
  };

  saveData(data);
  updateUI(data);
  return;
}

  checkReminders(data);
}, 60 * 1000);
