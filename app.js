const DB_NAME = "my-life-planner";
const STORE = "planner";
const STORAGE_KEY = "planner-data-v1";
const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const today = () => dateKey(new Date());
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

const defaultData = () => ({
  tasks: [],
  habits: [                       // recurring habits: { id, name }
    { id: "h1", name: "Drink a glass of water" },
    { id: "h2", name: "Move my body" },
    { id: "h3", name: "Read for 10 minutes" }
  ],
  habitLog: {},                   // { "YYYY-MM-DD": { habitId: true } }
  events: [],                     // shared with the calendar: { id, title, date, time, type }
  priorities: {},                 // { "YYYY-MM-DD": [ {text, done} x3 ] }
  blocks: [],                     // timetable: { id, date, start, end, title, cat }
  gratitude: {},                  // { "YYYY-MM-DD": [3 strings] }
  reflections: {},                // { "YYYY-MM-DD": { well, hard, tomorrow } }
  goals: [],
  mood: {},
  intention: "",
  notes: ""
});

let data = defaultData();
let currentFilter = "all";
let db = null;
let calendarDate = new Date();
let calendarView = "month";
let selectedCalendarDate = today();

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function loadData() {
  try {
    db = await openDatabase();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get("main");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (value) data = { ...defaultData(), ...value };
    else {
      const old = localStorage.getItem(STORAGE_KEY);
      if (old) data = { ...defaultData(), ...JSON.parse(old) };
      await saveData();
    }
  } catch (error) {
    try {
      const old = localStorage.getItem(STORAGE_KEY);
      if (old) data = { ...defaultData(), ...JSON.parse(old) };
    } catch (_) {}
    document.getElementById("connection-label").textContent = "Local browser storage";
  }
  normalizeData();
  renderAll();
  if (!navigator.onLine) updateConnection();
  // ask the browser not to evict planner data when storage is low
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
// Brings older saved data up to the current shape. Safe to run every time.
function normalizeData() {
  let changed = false;
  ["habitLog", "priorities", "gratitude", "reflections"].forEach(k => { if (!data[k]) { data[k] = {}; changed = true; } });
  ["events", "blocks"].forEach(k => { if (!Array.isArray(data[k])) { data[k] = []; changed = true; } });
  // old habits were tied to one date with a done flag: move ticks into the per-day log
  data.habits.forEach(h => {
    if ("date" in h || "done" in h) {
      if (h.done && h.date) (data.habitLog[h.date] = data.habitLog[h.date] || {})[h.id] = true;
      delete h.date; delete h.done; changed = true;
    }
  });
  if (changed) saveData();
}
function setSaveStatus(state) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.dataset.state = state;
  el.textContent = state === "saving" ? "Saving…"
    : state === "error" ? "⚠ Not saved"
    : "✓ Saved " + new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
async function saveData() {
  setSaveStatus("saving");
  try {
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(data, "main");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    setSaveStatus("saved");
  } catch (error) {
    setSaveStatus("error");
    toast("Couldn't save. Check your browser storage settings.");
  }
}
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function niceDate(value) {
  if (!value) return "";
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, { day:"numeric", month:"short" });
}
function renderAll() {
  renderTasks();
  renderHabits();
  renderGoals();
  renderMood();
  renderDay();
  renderDashboardPlan();
  document.getElementById("intention-input").value = data.intention || "";
  document.getElementById("notes-input").value = data.notes || "";
  const date = new Date();
  document.getElementById("top-date").textContent = date.toLocaleDateString(undefined, { weekday:"short", day:"numeric", month:"short" });
  document.getElementById("welcome-date").textContent = date.toLocaleDateString(undefined, { weekday:"long", day:"numeric", month:"long" }).toUpperCase();
}
function renderTasks() {
  const todayTasks = data.tasks.filter(t => !t.done && (!t.date || t.date <= today()));
  document.getElementById("task-count").textContent = todayTasks.length;
  const dashboard = document.getElementById("today-task-list");
  dashboard.innerHTML = todayTasks.slice(0, 5).map(taskHTML).join("");
  document.getElementById("task-empty").hidden = todayTasks.length > 0;
  const filtered = data.tasks.filter(t => currentFilter === "all" || (currentFilter === "open" ? !t.done : t.done));
  document.getElementById("all-task-list").innerHTML = filtered.map(taskHTML).join("");
  document.getElementById("all-task-empty").hidden = filtered.length > 0;
  document.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("active", b.dataset.filter === currentFilter));
  renderCalendar();     // keeps calendar, selected-day panel and day planner in step with task changes
  renderDayTasks();
}
function taskHTML(task) {
  return `<div class="task-row ${task.done ? "done" : ""}">
    <input type="checkbox" data-task-check="${task.id}" ${task.done ? "checked" : ""} aria-label="Mark ${escapeHTML(task.title)} complete">
    <label>${escapeHTML(task.title)}</label>
    ${task.date ? `<span class="task-date ${!task.done && task.date < today() ? "overdue" : ""}">${niceDate(task.date)}</span>` : ""}
    <button class="delete-button" data-task-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}
// ---- habits: recurring, one tick per habit per day ----
const isHabitDone = (id, date) => !!(data.habitLog[date] && data.habitLog[date][id]);
function toggleHabit(id, date) {
  const day = data.habitLog[date] = data.habitLog[date] || {};
  if (day[id]) delete day[id]; else day[id] = true;
  if (!Object.keys(day).length) delete data.habitLog[date];
  saveData();
}
function habitStreak(id) {
  let n = 0, d = today();
  if (!isHabitDone(id, d)) d = shiftDate(d, -1);     // today not ticked yet: don't break the streak
  while (isHabitDone(id, d)) { n++; d = shiftDate(d, -1); }
  return n;
}
function habitRowHTML(h, date, manage) {
  const done = isHabitDone(h.id, date), streak = habitStreak(h.id);
  const note = streak > 1 ? `${streak}-day streak` : done ? "Done" : "To do";
  return `<div class="habit-row"><button class="habit-check ${done ? "checked" : ""}" data-habit="${h.id}" data-date="${date}" aria-pressed="${done}" aria-label="Toggle ${escapeHTML(h.name)}">${done ? "✓" : ""}</button><label>${escapeHTML(h.name)}</label><small>${note}</small>${manage ? `<button class="delete-button" data-habit-delete="${h.id}" aria-label="Delete habit ${escapeHTML(h.name)}">×</button>` : ""}</div>`;
}
function renderHabits() {
  const t = today();
  const completed = data.habits.filter(h => isHabitDone(h.id, t)).length;
  document.getElementById("habit-count").textContent = `${completed} / ${data.habits.length}`;
  document.getElementById("habit-progress").textContent = `${completed} of ${data.habits.length} completed`;
  document.getElementById("dashboard-habits").innerHTML = data.habits.map(h => habitRowHTML(h, t, false)).join("") || '<p class="empty-hint">Add a habit to begin.</p>';
  document.getElementById("all-habits").innerHTML = data.habits.map(h => habitRowHTML(h, t, true)).join("") || '<p class="empty-hint">No habits yet.</p>';
  renderDayHabits();
}
function renderGoals() {
  document.getElementById("goal-count").textContent = data.goals.length;
  document.getElementById("goal-empty").hidden = data.goals.length > 0;
  document.getElementById("goal-list").innerHTML = data.goals.map(g => `<div class="goal-card"><div class="goal-top"><strong>${escapeHTML(g.name)}</strong><button class="delete-button" data-goal-delete="${g.id}" aria-label="Delete goal">×</button></div><div class="goal-controls"><input type="range" min="0" max="100" step="5" value="${g.progress}" data-goal-progress="${g.id}" aria-label="Goal progress"><span>${g.progress}%</span></div></div>`).join("");
}
function renderMood() {
  const mood = data.mood[today()] || "";
  document.querySelectorAll("[data-mood]").forEach(b => b.classList.toggle("selected", b.dataset.mood === mood));
  document.getElementById("mood-feedback").textContent = mood ? `You checked in: ${mood}. Thanks for noticing how you feel.` : "There is no right or wrong answer.";
}
function addTask(title, date = "") {
  data.tasks.unshift({ id: uid(), title: title.trim(), date, done: false });
  saveData(); renderTasks(); toast("Task added");
}
document.getElementById("quick-task-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("quick-task-input");
  if (input.value.trim()) { addTask(input.value); input.value = ""; }
});
document.getElementById("task-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("task-input");
  if (input.value.trim()) { addTask(input.value, document.getElementById("task-date").value); input.value = ""; document.getElementById("task-date").value = ""; }
});
document.addEventListener("change", e => {
  if (e.target.matches("[data-task-check]")) {
    const task = data.tasks.find(t => t.id === e.target.dataset.taskCheck);
    if (task) task.done = e.target.checked;
    saveData(); renderTasks();
  }
});
document.addEventListener("click", e => {
  const taskDelete = e.target.closest("[data-task-delete]");
  if (taskDelete) { data.tasks = data.tasks.filter(t => t.id !== taskDelete.dataset.taskDelete); saveData(); renderTasks(); }
  const habit = e.target.closest("[data-habit]");
  if (habit) { toggleHabit(habit.dataset.habit, habit.dataset.date || today()); renderHabits(); }
  const habitDelete = e.target.closest("[data-habit-delete]");
  if (habitDelete && confirm("Delete this habit and its history?")) {
    const id = habitDelete.dataset.habitDelete;
    data.habits = data.habits.filter(h => h.id !== id);
    Object.keys(data.habitLog).forEach(d => { delete data.habitLog[d][id]; if (!Object.keys(data.habitLog[d]).length) delete data.habitLog[d]; });
    saveData(); renderHabits();
  }
  const goalDelete = e.target.closest("[data-goal-delete]");
  if (goalDelete) { data.goals = data.goals.filter(g => g.id !== goalDelete.dataset.goalDelete); saveData(); renderGoals(); }
  const calendarCell = e.target.closest("[data-calendar-date]");
  if (calendarCell) {
    selectedCalendarDate = calendarCell.dataset.calendarDate;
    calendarDate = new Date(selectedCalendarDate + "T12:00:00");
    renderCalendar();
  }
  const calendarItem = e.target.closest("[data-calendar-item]");
  if (calendarItem) {
    const [kind, id] = calendarItem.dataset.calendarItem.split(":");
    if (kind === "task") {
      const task = data.tasks.find(t => t.id === id);
      if (task) { task.done = !task.done; saveData(); renderTasks(); renderSelectedDay(); }
    } else if (kind === "event") {
      data.events = data.events.filter(item => item.id !== id);
      saveData(); renderCalendar(); renderDay(); renderDashboardPlan(); toast("Event deleted");
    }
  }
});
document.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => { currentFilter = b.dataset.filter; renderTasks(); }));
document.getElementById("habit-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("habit-input");
  if (input.value.trim()) { data.habits.push({ id: uid(), name: input.value.trim() }); input.value = ""; saveData(); renderHabits(); toast("Habit added"); }
});
document.getElementById("goal-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("goal-input");
  if (input.value.trim()) { data.goals.push({ id: uid(), name: input.value.trim(), progress: 0 }); input.value = ""; saveData(); renderGoals(); toast("Goal added"); }
});
document.addEventListener("input", e => {
  if (e.target.matches("[data-goal-progress]")) {
    const goal = data.goals.find(g => g.id === e.target.dataset.goalProgress);
    if (goal) { goal.progress = Number(e.target.value); e.target.nextElementSibling.textContent = `${goal.progress}%`; saveData(); }
  }
});
document.getElementById("mood-options").addEventListener("click", e => {
  const button = e.target.closest("[data-mood]");
  if (button) { data.mood[today()] = button.dataset.mood; saveData(); renderMood(); }
});
document.getElementById("intention-input").addEventListener("input", e => {
  data.intention = e.target.value; saveData();
});
document.getElementById("notes-input").addEventListener("input", e => {
  data.notes = e.target.value; saveData();
});
document.getElementById("clear-notes").addEventListener("click", () => {
  if (confirm("Clear all your notes on this device?")) { data.notes = ""; document.getElementById("notes-input").value = ""; saveData(); }
});

// Calendar helpers and rendering
function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function addDays(date, amount) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + amount);
  return d;
}
function dateLabel(key, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  return new Date(key + "T12:00:00").toLocaleDateString(undefined, options);
}
function itemsForDate(key) {
  const events = (data.events || []).filter(item => item.date === key).map(item => ({...item, kind: "event"}));
  const tasks = data.tasks.filter(item => item.date === key).map(item => ({...item, kind: "task", type: "task"}));
  return [...events, ...tasks].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}
function calendarItemHTML(item, compact = false) {
  const type = item.kind === "task" ? "task" : item.type;
  const label = `${item.time ? item.time + " · " : ""}${item.title}`;
  if (compact) return `<span class="calendar-item ${type} ${item.kind === "task" && item.done ? "is-done" : ""}">${escapeHTML(label)}</span>`;
  return `<button type="button" class="calendar-item ${type} ${item.kind === "task" && item.done ? "is-done" : ""}" data-calendar-item="${item.kind}:${item.id}" title="${escapeHTML(item.kind === "task" ? "Click to mark task complete or incomplete" : "Click to delete event")}">${escapeHTML(label)}<span class="calendar-item-kind">${item.kind === "task" ? (item.done ? "Done" : "Task · click to complete") : escapeHTML(item.type)}</span></button>`;
}
function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  if (!grid) return;
  const heading = document.getElementById("calendar-heading");
  if (calendarView === "month") {
    heading.textContent = calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const first = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const start = startOfWeek(first);
    grid.className = "calendar-grid month-grid";
    grid.innerHTML = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<div class="calendar-weekday">${day}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const date = addDays(start, i), key = dateKey(date), items = itemsForDate(key);
      const inMonth = date.getMonth() === calendarDate.getMonth();
      grid.insertAdjacentHTML("beforeend", `<button type="button" class="calendar-day ${inMonth ? "" : "outside-month"} ${key === today() ? "is-today" : ""} ${key === selectedCalendarDate ? "is-selected" : ""}" data-calendar-date="${key}" aria-label="${dateLabel(key)}"><span class="calendar-day-number">${date.getDate()}</span><span class="calendar-day-items">${items.slice(0,3).map(item => calendarItemHTML(item,true)).join("")}${items.length > 3 ? `<small>+${items.length-3} more</small>` : ""}</span></button>`);
    }
  } else if (calendarView === "week") {
    const start = startOfWeek(calendarDate), end = addDays(start, 6);
    heading.textContent = `${start.toLocaleDateString(undefined,{day:"numeric",month:"short"})} – ${end.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}`;
    grid.className = "calendar-grid period-grid week-grid";
    grid.innerHTML = Array.from({length:7}, (_,i) => {
      const key = dateKey(addDays(start,i));
      return `<section class="period-day ${key === today() ? "is-today" : ""} ${key === selectedCalendarDate ? "is-selected" : ""}"><button type="button" class="period-day-heading" data-calendar-date="${key}">${dateLabel(key,{weekday:"short",day:"numeric"})}</button><div class="period-day-items">${itemsForDate(key).map(item => calendarItemHTML(item)).join("") || '<span class="muted">Nothing planned</span>'}</div></section>`;
    }).join("");
  } else {
    heading.textContent = dateLabel(selectedCalendarDate);
    grid.className = "calendar-grid period-grid day-grid";
    const items = itemsForDate(selectedCalendarDate);
    grid.innerHTML = `<section class="period-day selected-period-day"><div class="period-day-items">${items.map(item => calendarItemHTML(item)).join("") || '<p class="empty-hint">Nothing planned for this day yet.</p>'}</div></section>`;
  }
  document.querySelectorAll("[data-calendar-view]").forEach(button => button.classList.toggle("active", button.dataset.calendarView === calendarView));
  renderSelectedDay();
}
function renderSelectedDay() {
  const heading = document.getElementById("selected-day-heading"), container = document.getElementById("selected-day-events");
  if (!heading || !container) return;
  heading.textContent = dateLabel(selectedCalendarDate, {weekday:"short", day:"numeric", month:"short"});
  const items = itemsForDate(selectedCalendarDate);
  container.innerHTML = items.length ? items.map(item => calendarItemHTML(item)).join("") : '<p class="empty-hint">Nothing planned for this date. Enjoy the breathing room.</p>';
}
document.getElementById("event-form").addEventListener("submit", event => {
  event.preventDefault();
  const title = document.getElementById("event-title"), date = document.getElementById("event-date");
  if (!title.value.trim() || !date.value) return;
  data.events = data.events || [];
  data.events.push({id:uid(), title:title.value.trim(), date:date.value, time:document.getElementById("event-time").value, type:document.getElementById("event-type").value});
  selectedCalendarDate = date.value; calendarDate = new Date(date.value + "T12:00:00");
  saveData(); renderCalendar(); renderDay(); renderDashboardPlan(); title.value = ""; document.getElementById("event-time").value = "";
  toast("Event saved to your calendar");
});
document.getElementById("calendar-prev").addEventListener("click", () => {
  if (calendarView === "month") calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()-1, 1);
  else if (calendarView === "week") calendarDate = addDays(calendarDate,-7);
  else { selectedCalendarDate = dateKey(addDays(new Date(selectedCalendarDate+"T12:00:00"),-1)); calendarDate = new Date(selectedCalendarDate+"T12:00:00"); }
  renderCalendar();
});
document.getElementById("calendar-next").addEventListener("click", () => {
  if (calendarView === "month") calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()+1, 1);
  else if (calendarView === "week") calendarDate = addDays(calendarDate,7);
  else { selectedCalendarDate = dateKey(addDays(new Date(selectedCalendarDate+"T12:00:00"),1)); calendarDate = new Date(selectedCalendarDate+"T12:00:00"); }
  renderCalendar();
});
document.getElementById("calendar-today").addEventListener("click", () => {calendarDate=new Date();selectedCalendarDate=today();renderCalendar();});
document.querySelectorAll("[data-calendar-view]").forEach(button => button.addEventListener("click", () => {calendarView=button.dataset.calendarView;renderCalendar();}));
document.getElementById("event-date").value = today();

function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  document.getElementById(`${name}-view`).classList.add("active-view");
  document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.getElementById("section-name").textContent = (name === "day" ? "day planner" : name).toUpperCase();
  if (name === "day") renderDay();       // always show the date currently selected in the calendar
  document.getElementById("sidebar").classList.remove("open");
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showView(b.dataset.go)));
document.getElementById("menu-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
let swReady = false;
function updateConnection() {
  document.getElementById("connection-label").textContent = !navigator.onLine ? "Offline mode" : swReady ? "Available offline" : "Ready to plan";
}
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").then(() => navigator.serviceWorker.ready).then(() => { swReady = true; updateConnection(); }).catch(() => {
    document.getElementById("connection-label").textContent = "Offline setup pending";
  }));
}
/* ======================================================================
   Day planner: priorities, habits, tasks due, timetable, events,
   gratitude and reflection. Uses the calendar's selected date
   (selectedCalendarDate) and the calendar's event list (data.events).
   ====================================================================== */
const $ = id => document.getElementById(id);
const parseKey = key => new Date(key + "T12:00:00");
const shiftDate = (key, n) => dateKey(addDays(parseKey(key), n));
const CATEGORY_LABELS = { work: "Work", personal: "Personal", care: "Self-care", other: "Other" };
const PRIORITY_HINTS = ["The one thing that matters most", "Next most important", "If there's room"];
const GRATITUDE_HINTS = ["I'm grateful for...", "Something small that made me smile", "Someone who helped me"];

/* ---------- helpers ---------- */
const eventsOn = date => (data.events || [])
  .filter(e => e.date === date)
  .sort((a, b) => (a.time || "").localeCompare(b.time || "") || a.title.localeCompare(b.title));
const blocksOn = date => data.blocks
  .filter(b => b.date === date)
  .sort((a, b) => a.start.localeCompare(b.start) || (a.end || "").localeCompare(b.end || ""));
// tasks due on a date; on today's page, unfinished overdue tasks are included too
const dayTasks = date => data.tasks.filter(t => t.date === date || (date === today() && t.date && t.date < date && !t.done));
const prioritiesFor = date => {
  const saved = data.priorities[date] || [];
  return [0, 1, 2].map(i => ({ text: (saved[i] && saved[i].text) || "", done: !!(saved[i] && saved[i].done) }));
};
const gratitudeFor = date => { const g = data.gratitude[date] || []; return [0, 1, 2].map(i => g[i] || ""); };
function setPriority(index, patch) {
  const list = prioritiesFor(selectedCalendarDate);
  Object.assign(list[index], patch);
  data.priorities[selectedCalendarDate] = list;
  saveData();
}
function setReflection(key, value) {
  data.reflections[selectedCalendarDate] = { ...(data.reflections[selectedCalendarDate] || {}), [key]: value };
  saveData();
}
function relativeLabel(date) {
  const t = today();
  if (date === t) return "TODAY";
  if (date === shiftDate(t, 1)) return "TOMORROW";
  if (date === shiftDate(t, -1)) return "YESTERDAY";
  return "";
}
const minutesToTime = total => { const m = ((total % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const timeToMinutes = value => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };

/* ---------- navigation between calendar and planner ---------- */
function setDay(date) {
  selectedCalendarDate = date;
  calendarDate = parseKey(date);
  renderDay();
  renderCalendar();
}
function openDay(date) {
  setDay(date);
  showView("day");
  window.scrollTo({ top: 0 });
}

/* ---------- the day page ---------- */
function renderDay() {
  if (!$("day-title")) return;
  const d = parseKey(selectedCalendarDate);
  const rel = relativeLabel(selectedCalendarDate);
  $("day-eyebrow").textContent = d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }).toUpperCase() + (rel ? ` · ${rel}` : "");
  $("day-title").innerHTML = `${escapeHTML(d.toLocaleDateString(undefined, { weekday: "long" }))}<span class="period">.</span>`;
  $("day-date-input").value = selectedCalendarDate;
  renderPriorities();
  renderDayEvents();
  renderBlocks();
  renderDayTasks();
  renderDayHabits();
  renderGratitude();
  renderReflection();
}

/* three priorities */
function renderPriorities() {
  $("priority-list").innerHTML = prioritiesFor(selectedCalendarDate).map((p, i) => `
    <div class="priority-row ${p.done ? "done" : ""}">
      <span class="priority-num">${i + 1}</span>
      <input type="checkbox" data-prio-done="${i}" ${p.done ? "checked" : ""} aria-label="Priority ${i + 1} done">
      <input class="priority-input" data-prio-text="${i}" maxlength="100" value="${escapeHTML(p.text)}" placeholder="${PRIORITY_HINTS[i]}" aria-label="Priority ${i + 1}">
    </div>`).join("");
}

/* events & appointments (same list the calendar uses) */
function renderDayEvents() {
  const list = eventsOn(selectedCalendarDate);
  $("day-event-list").innerHTML = list.map(e => `
    <div class="row-card event-row ${escapeHTML(e.type)}">
      <span class="ev-time">${e.time ? escapeHTML(e.time) : "All day"}</span>
      <div><strong>${escapeHTML(e.title)}</strong><small class="ev-kind">${escapeHTML(e.type)}</small></div>
      <button type="button" class="delete-button" data-ev-delete="${e.id}" aria-label="Delete ${escapeHTML(e.title)}">×</button>
    </div>`).join("");
  $("day-event-empty").hidden = list.length > 0;
}

/* editable timetable */
function renderBlocks() {
  const list = blocksOn(selectedCalendarDate);
  $("block-list").innerHTML = list.map(b => `
    <div class="row-card block-row ${b.cat}">
      <div class="row-times">
        <input type="time" data-bl-field="start" data-id="${b.id}" value="${b.start}" aria-label="Start time" required>
        <span>–</span>
        <input type="time" data-bl-field="end" data-id="${b.id}" value="${b.end || ""}" aria-label="End time">
      </div>
      <input class="row-title" data-bl-field="title" data-id="${b.id}" maxlength="80" value="${escapeHTML(b.title)}" aria-label="Title">
      <button type="button" class="delete-button" data-bl-delete="${b.id}" aria-label="Delete ${escapeHTML(b.title)}">×</button>
      <div class="row-sub">
        <select data-bl-field="cat" data-id="${b.id}" aria-label="Category">
          ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}" ${b.cat === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </div>
    </div>`).join("");
  $("block-empty").hidden = list.length > 0;
}

/* tasks due this day */
function dayTaskHTML(task) {
  return `<div class="task-row ${task.done ? "done" : ""}">
    <input type="checkbox" data-task-check="${task.id}" ${task.done ? "checked" : ""} aria-label="Mark ${escapeHTML(task.title)} complete">
    <label>${escapeHTML(task.title)}${task.date !== selectedCalendarDate ? ` <span class="task-date overdue">overdue · ${niceDate(task.date)}</span>` : ""}</label>
    <button class="delete-button" data-task-push="${task.id}" title="Move to the next day" aria-label="Move ${escapeHTML(task.title)} to the next day">→</button>
    <button class="delete-button" data-task-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}
function renderDayTasks() {
  const list = $("day-task-list");
  if (!list) return;
  const tasks = dayTasks(selectedCalendarDate);
  list.innerHTML = tasks.map(dayTaskHTML).join("");
  $("day-task-empty").hidden = tasks.length > 0;
}

/* habit checklist: the same recurring habits as the Habits page */
function renderDayHabits() {
  const list = $("day-habit-list");
  if (!list) return;
  const done = data.habits.filter(h => isHabitDone(h.id, selectedCalendarDate)).length;
  list.innerHTML = data.habits.map(h => habitRowHTML(h, selectedCalendarDate, false)).join("");
  $("day-habit-empty").hidden = data.habits.length > 0;
  $("day-habit-progress").textContent = data.habits.length ? `${done} of ${data.habits.length} done` : "";
}

/* gratitude: three lines per day */
function renderGratitude() {
  $("gratitude-list").innerHTML = gratitudeFor(selectedCalendarDate).map((g, i) => `
    <div class="priority-row">
      <span class="priority-num">${i + 1}</span>
      <input class="priority-input" data-grat="${i}" maxlength="120" value="${escapeHTML(g)}" placeholder="${GRATITUDE_HINTS[i]}" aria-label="Gratitude ${i + 1}">
    </div>`).join("");
}

/* daily reflection + mood */
function renderReflection() {
  const r = data.reflections[selectedCalendarDate] || {};
  ["well", "hard", "tomorrow"].forEach(k => { $("refl-" + k).value = r[k] || ""; });
  const mood = data.mood[selectedCalendarDate] || "";
  document.querySelectorAll("[data-day-mood]").forEach(b => b.classList.toggle("selected", b.dataset.dayMood === mood));
}

/* dashboard summary for today */
function renderDashboardPlan() {
  const t = today();
  const prios = prioritiesFor(t).map((p, i) => ({ ...p, n: i + 1 })).filter(p => p.text.trim());
  $("plan-priorities").innerHTML = prios.length
    ? prios.map(p => `<li class="${p.done ? "done" : ""}"><span class="priority-num">${p.n}</span>${escapeHTML(p.text)}</li>`).join("")
    : '<li class="empty-hint">Choose up to three priorities for today.</li>';
  const blocks = blocksOn(t);
  $("plan-blocks").innerHTML = blocks.length
    ? blocks.map(b => `<li><b>${escapeHTML(b.start)}${b.end ? "–" + escapeHTML(b.end) : ""}</b>${escapeHTML(b.title)}</li>`).join("")
    : '<li class="empty-hint">No time blocks yet.</li>';
  const evs = eventsOn(t);
  $("plan-events").innerHTML = evs.length
    ? evs.map(e => `<li><b>${e.time ? escapeHTML(e.time) : "All day"}</b>${escapeHTML(e.title)}</li>`).join("")
    : '<li class="empty-hint">Nothing scheduled today.</li>';
}

/* ---------- wiring ---------- */
$("day-back").addEventListener("click", () => { renderCalendar(); showView("calendar"); });
$("day-prev").addEventListener("click", () => setDay(shiftDate(selectedCalendarDate, -1)));
$("day-next").addEventListener("click", () => setDay(shiftDate(selectedCalendarDate, 1)));
$("day-today").addEventListener("click", () => setDay(today()));
$("day-date-input").addEventListener("change", e => { if (e.target.value) setDay(e.target.value); });
$("plan-open-today").addEventListener("click", () => openDay(today()));
$("open-planner-from-calendar").addEventListener("click", () => openDay(selectedCalendarDate));

$("dp-event-form").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("dp-event-title").value.trim();
  if (!title) return;
  data.events.push({ id: uid(), title, date: selectedCalendarDate, time: $("dp-event-time").value, type: $("dp-event-type").value });
  e.target.reset();
  saveData(); renderDayEvents(); renderCalendar(); renderDashboardPlan(); toast("Added to your calendar");
});

$("block-form").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("block-title").value.trim();
  const start = $("block-start").value, end = $("block-end").value;
  if (!title || !start) return;
  if (end && end <= start) { toast("End time should be after the start time"); return; }
  data.blocks.push({ id: uid(), date: selectedCalendarDate, start, end, title, cat: $("block-cat").value });
  $("block-title").value = "";
  // get the next block ready: starts where this one ended, lasts an hour
  if (end) { $("block-start").value = end; $("block-end").value = minutesToTime(timeToMinutes(end) + 60); }
  saveData(); renderBlocks(); renderDashboardPlan(); toast("Time block added");
});

$("day-task-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("day-task-input");
  if (input.value.trim()) { addTask(input.value, selectedCalendarDate); input.value = ""; }
});

$("day-mood-options").addEventListener("click", e => {
  const button = e.target.closest("[data-day-mood]");
  if (!button) return;
  data.mood[selectedCalendarDate] = button.dataset.dayMood;
  saveData(); renderReflection(); renderMood();
});

/* typing saves as you go, without redrawing (keeps the cursor in place) */
document.addEventListener("input", e => {
  const t = e.target;
  if (t.matches("[data-prio-text]")) { setPriority(Number(t.dataset.prioText), { text: t.value }); renderDashboardPlan(); }
  else if (t.matches("[data-grat]")) {
    const list = gratitudeFor(selectedCalendarDate); list[Number(t.dataset.grat)] = t.value;
    data.gratitude[selectedCalendarDate] = list; saveData();
  }
  else if (t.matches("[data-refl]")) setReflection(t.dataset.refl, t.value);
  else if (t.matches("[data-bl-field='title']")) {
    const b = data.blocks.find(x => x.id === t.dataset.id);
    if (b) { b.title = t.value; saveData(); renderDashboardPlan(); }
  }
});

/* committed changes (times, dropdowns, checkboxes): save and re-sort */
document.addEventListener("change", e => {
  const t = e.target;
  if (t.matches("[data-prio-done]")) {
    setPriority(Number(t.dataset.prioDone), { done: t.checked });
    t.closest(".priority-row").classList.toggle("done", t.checked);
    renderDashboardPlan();
  } else if (t.matches("[data-bl-field='start'], [data-bl-field='end'], [data-bl-field='cat']")) {
    const b = data.blocks.find(x => x.id === t.dataset.id);
    if (!b) return;
    const field = t.dataset.blField;
    if (field === "start" && !t.value) { t.value = b.start; return; }
    const next = { ...b, [field]: t.value };
    if (next.end && next.end <= next.start) { toast("End time should be after the start time"); t.value = b[field] || ""; return; }
    b[field] = t.value;
    saveData(); renderBlocks(); renderDashboardPlan();
  }
});

document.addEventListener("click", e => {
  const evDelete = e.target.closest("[data-ev-delete]");
  if (evDelete) {
    data.events = data.events.filter(x => x.id !== evDelete.dataset.evDelete);
    saveData(); renderDayEvents(); renderCalendar(); renderDashboardPlan(); toast("Event deleted");
  }
  const blDelete = e.target.closest("[data-bl-delete]");
  if (blDelete) {
    data.blocks = data.blocks.filter(x => x.id !== blDelete.dataset.blDelete);
    saveData(); renderBlocks(); renderDashboardPlan();
  }
  const push = e.target.closest("[data-task-push]");
  if (push) {
    const task = data.tasks.find(x => x.id === push.dataset.taskPush);
    if (task) { task.date = shiftDate(selectedCalendarDate, 1); saveData(); renderTasks(); toast("Moved to the next day"); }
  }
});

loadData();
