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
  habits: [
    { id: "h1", name: "Drink a glass of water", done: false, date: today() },
    { id: "h2", name: "Move my body", done: false, date: today() },
    { id: "h3", name: "Read for 10 minutes", done: false, date: today() }
  ],
  goals: [],
  mood: {},
  intention: "",
  notes: "",
  dailyPlans: {},
  weeklyReviews: {},
  weeklyPlans: {},
  monthlyPlans: {}, recipes: [], meals: [], groceries: [], cleaning: [], projects: [], collections: [], foodLogs: [], workouts: [], wellness: {}, yearlyPlans: {}, milestones: [], routines: [], finance: [], trips: [], dashboardHidden: [], homeRecords: [], savingsGoals: [], subscriptions: [], itinerary: [], plannerTheme: "earth"
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
  data.dailyPlans = data.dailyPlans || {};
  data.habits = data.habits || [];
  data.habits.forEach(h => { if (!h.frequency) h.frequency = "daily"; if (h.done && h.date) { data.dailyPlans[h.date] = data.dailyPlans[h.date] || { priorities:["","",""], schedule:[], reflection:{}, habitChecks:[] }; const checks=data.dailyPlans[h.date].habitChecks || (data.dailyPlans[h.date].habitChecks=[]); if(!checks.includes(h.id)) checks.push(h.id); } });
  data.weeklyReviews = data.weeklyReviews || {};
  data.weeklyPlans = data.weeklyPlans || {};
  data.recipes = data.recipes || [];
  data.monthlyPlans = data.monthlyPlans || {};
  data.events = data.events || [];
  ["yearlyPlans","milestones","routines","finance","trips","homeRecords","savingsGoals","subscriptions","itinerary"].forEach(k=>{data[k]=data[k]|| (k==="yearlyPlans"?{}:[]);});
  data.dashboardHidden=data.dashboardHidden||[];
  if(data.autoCarryTasks){data.tasks.forEach(t=>{if(!t.done&&t.date&&t.date<today())t.date=today();});}
  renderAll();
}
async function saveData() {
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
  } catch (error) {
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
function renderDashboardOverview() {
  const weekStart = startOfWeek(new Date(today() + "T12:00:00"));
  const weekEnd = addDays(weekStart, 6);
  const startKey = dateKey(weekStart), endKey = dateKey(weekEnd);
  const weeklyTasks = data.tasks.filter(task => task.date && task.date >= startKey && task.date <= endKey);
  const weeklyDone = weeklyTasks.filter(task => task.done).length;
  const weekCount = document.getElementById("week-task-count");
  const weekCaption = document.getElementById("week-task-caption");
  if (weekCount) weekCount.textContent = `${weeklyDone} / ${weeklyTasks.length}`;
  if (weekCaption) weekCaption.textContent = weeklyTasks.length ? "Tasks completed this week" : "Add a dated task to begin";
  const todayLife = document.getElementById("dashboard-today-life");
  if (todayLife) {
    const meals = (data.meals || []).filter(x => x.date === today()).sort((a,b) => ["Breakfast","Lunch","Dinner","Snack"].indexOf(a.type)-["Breakfast","Lunch","Dinner","Snack"].indexOf(b.type));
    const workouts = (data.workouts || []).filter(x => x.date === today());
    const priorities = (getDailyPlan(today()).priorities || []).filter(Boolean);
    todayLife.innerHTML = `<div class="today-life-block"><strong>Today's meals</strong>${meals.length ? meals.map(m=>`<span>${escapeHTML(m.type)} · ${escapeHTML(m.name)}</span>`).join("") : '<small>No meals planned yet.</small>'}</div><div class="today-life-block"><strong>Movement</strong>${workouts.length ? workouts.map(w=>`<span>${escapeHTML(w.name)}${w.duration?` · ${escapeHTML(w.duration)} min`:""}</span>`).join("") : '<small>No workout logged today.</small>'}</div><div class="today-life-block"><strong>Top priorities</strong>${priorities.length ? priorities.map(x=>`<span>${escapeHTML(x)}</span>`).join("") : '<small>Add priorities in your Daily Planner.</small>'}</div>`;
  }
  const upcoming = document.getElementById("dashboard-upcoming");
  if (!upcoming) return;
  const found = [];
  for (let i = 0; i < 14; i++) {
    const key = dateKey(addDays(new Date(today() + "T12:00:00"), i));
    eventsForDate(key).forEach(event => found.push({...event, dayKey:key}));
  }
  const unique = [...new Map(found.map(item => [`${item.id}:${item.dayKey}`, item])).values()].slice(0, 5);
  upcoming.innerHTML = unique.length ? unique.map(item => `<div class="upcoming-event-row"><span class="legend-dot ${escapeHTML(item.type)}"></span><span><strong>${escapeHTML(item.title)}</strong><small>${dateLabel(item.dayKey,{weekday:"short",day:"numeric",month:"short"})}${item.time ? " · "+escapeHTML(item.time) : ""}</small></span></div>`).join("") : '<p class="empty-hint">Nothing coming up in the next two weeks.</p>';
}

function renderAll() {
  renderTasks();
  renderHabits();
  renderGoals();
  renderMood();
  document.getElementById("intention-input").value = data.intention || "";
  document.getElementById("notes-input").value = data.notes || "";
  const date = new Date();
  document.getElementById("top-date").textContent = date.toLocaleDateString(undefined, { weekday:"short", day:"numeric", month:"short" });
  document.getElementById("welcome-date").textContent = date.toLocaleDateString(undefined, { weekday:"long", day:"numeric", month:"long" }).toUpperCase();
  renderCalendar();
  renderDashboardOverview();
 
 renderDashboardSettings();
 document.body.dataset.theme = data.plannerTheme || "earth";
 renderLifeSections();
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
  renderDashboardOverview();
}
function taskHTML(task) {
  return `<div class="task-row ${task.done ? "done" : ""}">
    <input type="checkbox" data-task-check="${task.id}" ${task.done ? "checked" : ""} aria-label="Mark ${escapeHTML(task.title)} complete">
    <label>${escapeHTML(task.title)}</label>
    ${task.projectId ? `<span class="task-project-tag">${escapeHTML(data.projects.find(p=>p.id===task.projectId)?.name||"Project")}</span>` : ""}
    ${task.date ? `<span class="task-date">${niceDate(task.date)}</span>` : ""}
    ${task.repeatGroup ? `<span class="task-repeat-tag" title="Repeating task">↻</span>` : ""}
    <button class="delete-button" data-task-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}
function habitTarget(h) { return h.frequency === "2x" ? 2 : h.frequency === "3x" ? 3 : h.frequency === "weekly" ? 1 : h.frequency === "weekdays" ? 5 : h.frequency === "weekends" ? 2 : 7; }
function habitChecksFor(key) { return new Set((data.dailyPlans?.[key]?.habitChecks) || []); }
function habitIsDue(h, key = today()) {
  const day = new Date(key + "T12:00:00").getDay();
  if (h.frequency === "weekdays") return day >= 1 && day <= 5;
  if (h.frequency === "weekends") return day === 0 || day === 6;
  if (["2x","3x","weekly"].includes(h.frequency)) return habitCompletionCount(h, weekKey(key)) < habitTarget(h);
  return true;
}
function habitCompletionCount(h, weekStartKey) {
  const start = new Date(weekStartKey + "T12:00:00"); let count = 0;
  for (let i=0;i<7;i++) if (habitChecksFor(dateKey(addDays(start,i))).has(h.id)) count++;
  return count;
}
function habitStreak(h) {
  let streak = 0; const d = new Date(today() + "T12:00:00");
  for (let i=0;i<370;i++) { const key=dateKey(d),done=habitChecksFor(key).has(h.id); if(done) streak++; else if(habitIsDue(h,key)) break; d.setDate(d.getDate()-1); }
  return streak;
}
function renderHabits() {
  const todays = data.habits.filter(h => habitIsDue(h) || habitChecksFor(today()).has(h.id));
  const checked = habitChecksFor(today());
  const completed = todays.filter(h => checked.has(h.id)).length;
  document.getElementById("habit-count").textContent = `${completed} / ${todays.length}`;
  document.getElementById("habit-progress").textContent = `${completed} of ${todays.length} due today completed`;
  const html = todays.map(h => `<div class="habit-row"><button class="habit-check ${checked.has(h.id) ? "checked" : ""}" data-habit="${h.id}" aria-label="Toggle ${escapeHTML(h.name)}">${checked.has(h.id) ? "✓" : ""}</button><label>${escapeHTML(h.name)}</label><small>${habitStreak(h)} day streak</small></div>`).join("");
  document.getElementById("dashboard-habits").innerHTML = html || '<p class="empty-hint">No habits due today. Enjoy the breathing room.</p>';
  document.getElementById("all-habits").innerHTML = html || '<p class="empty-hint">No habits due today.</p>';
}
function renderGoals() {
  document.getElementById("goal-count").textContent = data.goals.filter(g => (g.progress||0) < 100).length;
  document.getElementById("goal-empty").hidden = data.goals.length > 0;
  document.getElementById("goal-list").innerHTML = data.goals.map(g => `<div class="goal-card"><div class="goal-top"><div><strong>${escapeHTML(g.name)}</strong><small class="goal-meta">${escapeHTML(g.category||"Personal")}${g.date?" · Due "+niceDate(g.date):""}</small></div><button class="delete-button" data-goal-delete="${g.id}" aria-label="Delete goal">×</button></div>${g.why?`<p class="goal-why">Why: ${escapeHTML(g.why)}</p>`:""}<label class="goal-next-step">Next step<input data-goal-field="next" data-goal-id="${g.id}" value="${escapeHTML(g.next||"")}" placeholder="Add one small action..."></label><div class="goal-controls"><input type="range" min="0" max="100" step="5" value="${g.progress||0}" data-goal-progress="${g.id}" aria-label="Goal progress"><span>${g.progress||0}%</span></div></div>`).join("");
}
function renderMood() {
  const mood = data.mood[today()] || "";
  document.querySelectorAll("[data-mood]").forEach(b => b.classList.toggle("selected", b.dataset.mood === mood));
  document.getElementById("mood-feedback").textContent = mood ? `You checked in: ${mood}. Thanks for noticing how you feel.` : "There is no right or wrong answer.";
}
function isRecurringOnDate(startKey, candidateKey, frequency) {
  if (!startKey || candidateKey < startKey) return false;
  if (frequency === "none" || !frequency) return candidateKey === startKey;
  const start = new Date(startKey + "T12:00:00");
  const candidate = new Date(candidateKey + "T12:00:00");
  const days = Math.round((candidate - start) / 86400000);
  if (frequency === "daily") return true;
  if (frequency === "weekly") return days % 7 === 0;
  if (frequency === "monthly") return candidate.getDate() === start.getDate();
  if (frequency === "yearly") return candidate.getDate() === start.getDate() && candidate.getMonth() === start.getMonth();
  return candidateKey === startKey;
}
function addTask(title, date = "", frequency = "none", repeatUntil = "") {
  const cleanTitle = title.trim();
  if (!cleanTitle) return false;
  if (frequency !== "none") {
    if (!date || !repeatUntil || repeatUntil < date) {
      toast("Choose a due date and a valid repeat-until date");
      return false;
    }
    const group = uid();
    const start = new Date(date + "T12:00:00");
    const end = new Date(repeatUntil + "T12:00:00");
    const occurrences = [];
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      const key = dateKey(cursor);
      if (isRecurringOnDate(date, key, frequency)) occurrences.push({ id: uid(), repeatGroup: group, repeatFrequency: frequency, title: cleanTitle, date: key, done: false });
    }
    data.tasks.unshift(...occurrences.reverse());
    saveData(); renderTasks(); renderCalendar(); renderDailyPlanner(); renderWeeklyReview();
    toast(`${occurrences.length} repeating task${occurrences.length === 1 ? "" : "s"} added`);
    return true;
  }
  data.tasks.unshift({ id: uid(), title: cleanTitle, date, done: false });
  saveData(); renderTasks(); renderCalendar(); renderDailyPlanner(); renderWeeklyReview(); toast("Task added");
  return true;
}
document.getElementById("quick-task-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("quick-task-input");
  if (input.value.trim()) { addTask(input.value); input.value = ""; }
});
document.getElementById("task-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("task-input");
  const repeat = document.getElementById("task-repeat").value;
  const added = addTask(input.value, document.getElementById("task-date").value, repeat, document.getElementById("task-repeat-until").value);
  if (added) { input.value = ""; document.getElementById("task-date").value = ""; document.getElementById("task-repeat").value = "none"; document.getElementById("task-repeat-until").value = ""; }
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
  if (habit) { const item = data.habits.find(h => h.id === habit.dataset.habit); if (item) { const checks=habitChecksFor(today()); checks.has(item.id)?checks.delete(item.id):checks.add(item.id); getDailyPlan(today()).habitChecks=[...checks]; } saveData(); renderHabits(); renderDailyPlanner(); renderWeeklyReview(); }
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
      if (task) { task.done = !task.done; saveData(); renderTasks(); renderSelectedDay(); renderDailyTasks(); renderWeeklyReview(); }
    } else if (kind === "event") {
      data.events = data.events.filter(item => item.id !== id);
      saveData(); renderCalendar(); renderDailyPlanner(); renderWeeklyReview(); renderDashboardOverview(); toast("Event deleted");
    }
  }
});
document.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => { currentFilter = b.dataset.filter; renderTasks(); }));
document.getElementById("habit-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("habit-input");
  if (input.value.trim()) { data.habits.push({ id: uid(), name: input.value.trim(), frequency: document.getElementById("habit-frequency").value || "daily" }); input.value = ""; saveData(); renderHabits(); renderDailyPlanner(); renderWeeklyReview(); toast("Habit added"); }
});
document.getElementById("goal-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("goal-input");
  if (input.value.trim()) { data.goals.push({ id: uid(), name: input.value.trim(), category: document.getElementById("goal-category").value, date: document.getElementById("goal-date").value, why: document.getElementById("goal-why").value.trim(), next: document.getElementById("goal-next").value.trim(), progress: 0 }); e.target.reset(); saveData(); renderGoals(); toast("Goal added"); }
});
document.addEventListener("input", e => {
  if (e.target.matches("[data-goal-progress]")) {
    const goal = data.goals.find(g => g.id === e.target.dataset.goalProgress);
    if (goal) { goal.progress = Number(e.target.value); e.target.nextElementSibling.textContent = `${goal.progress}%`; saveData(); renderDashboardOverview(); }
  }
  if (e.target.matches("[data-goal-field]")) { const goal=data.goals.find(g=>g.id===e.target.dataset.goalId); if(goal){goal[e.target.dataset.goalField]=e.target.value;saveData();} }
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
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
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
function eventOccurrenceOnDate(item, key) {
  const startKey = item.date || item.startDate;
  if (!startKey) return null;
  const durationEnd = item.endDate || startKey;
  const duration = Math.max(0, Math.round((new Date(durationEnd + "T12:00:00") - new Date(startKey + "T12:00:00")) / 86400000));
  const frequency = item.repeatFrequency || "none";
  const lastStart = item.repeatUntil || startKey;
  const searchStart = dateKey(addDays(new Date(key + "T12:00:00"), -duration));
  const from = searchStart > startKey ? searchStart : startKey;
  const to = key < lastStart ? key : lastStart;
  if (to < from) return null;
  for (let cursor = new Date(from + "T12:00:00"); cursor <= new Date(to + "T12:00:00"); cursor = addDays(cursor, 1)) {
    const occurrenceStart = dateKey(cursor);
    if (isRecurringOnDate(startKey, occurrenceStart, frequency)) {
      const occurrenceEnd = dateKey(addDays(cursor, duration));
      if (key >= occurrenceStart && key <= occurrenceEnd) return { occurrenceStart, occurrenceEnd };
    }
  }
  return null;
}
function eventOccursOnDate(item, key) { return !!eventOccurrenceOnDate(item, key); }
function eventsForDate(key) {
  return (data.events || []).flatMap(item => {
    const occurrence = eventOccurrenceOnDate(item, key);
    return occurrence ? [{...item, date: occurrence.occurrenceStart, endDate: occurrence.occurrenceEnd, occurrenceDate: key, kind: "event"}] : [];
  });
}
function itemsForDate(key) {
  const events = eventsForDate(key);
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
  const endDateInput = document.getElementById("event-end-date");
  const endDate = endDateInput.value || date.value;
  if (endDate < date.value) { toast("End date must be the same as or after the start date"); endDateInput.focus(); return; }
  const isMultiDay = endDate > date.value;
  const repeatFrequency = document.getElementById("event-repeat").value;
  const repeatUntil = document.getElementById("event-repeat-until").value;
  if (repeatFrequency !== "none" && (!repeatUntil || repeatUntil < date.value)) {
    toast("Choose a repeat-until date on or after the event date");
    document.getElementById("event-repeat-until").focus();
    return;
  }
  data.events.push({id:uid(), title:title.value.trim(), date:date.value, endDate, time:document.getElementById("event-time").value, type:document.getElementById("event-type").value, repeatFrequency, repeatUntil});
  selectedCalendarDate = date.value; calendarDate = new Date(date.value + "T12:00:00");
  dailySelectedDate = date.value;
  saveData(); renderCalendar(); renderDailyPlanner(); renderWeeklyReview(); renderDashboardOverview();
  title.value = ""; date.value = today(); endDateInput.value = ""; document.getElementById("event-time").value = ""; document.getElementById("event-repeat").value = "none"; document.getElementById("event-repeat-until").value = "";
  toast(repeatFrequency !== "none" ? "Repeating event saved" : (isMultiDay ? "Multi-day event saved" : "Event saved to your calendar"));
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

// Daily Planner: each date has its own priorities, schedule and reflection.
let dailySelectedDate = today();
function getDailyPlan(key = dailySelectedDate) {
  data.dailyPlans = data.dailyPlans || {};
  if (!data.dailyPlans[key]) data.dailyPlans[key] = { priorities: ["", "", ""], schedule: [], reflection: {}, habitChecks: [] };
  const plan = data.dailyPlans[key];
  plan.priorities = Array.isArray(plan.priorities) ? plan.priorities : ["", "", ""];
  plan.schedule = Array.isArray(plan.schedule) ? plan.schedule : [];
  plan.reflection = plan.reflection || {};
  plan.habitChecks = Array.isArray(plan.habitChecks) ? plan.habitChecks : [];
  return plan;
}
function saveDailyPlan() {
  saveData();
  const status = document.getElementById("daily-save-status");
  if (status) status.textContent = "Saved on this device · " + new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}
function renderDailyPlanner() {
  const dateInput = document.getElementById("daily-date");
  if (!dateInput) return;
  dateInput.value = dailySelectedDate;
  const plan = getDailyPlan();
  [1,2,3].forEach((n,i) => { const el=document.getElementById(`priority-${n}`); if(el) el.value=plan.priorities[i] || ""; });
  ["well","challenge","grateful"].forEach(k => { const el=document.getElementById(`reflection-${k}`); if(el) el.value=plan.reflection[k] || ""; });
  renderDailySchedule(); renderDailyEvents(); renderDailyTasks(); renderDailyHabits();
}
function renderDailySchedule() {
  const el=document.getElementById("daily-schedule-list"); if(!el) return;
  const items=getDailyPlan().schedule.slice().sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  el.innerHTML=items.length ? items.map(item=>`<div class="daily-schedule-item"><span><strong>${escapeHTML(item.time)}</strong> · ${escapeHTML(item.activity)}</span><button type="button" class="daily-delete-button" data-schedule-delete="${escapeHTML(item.id)}" aria-label="Delete schedule item">Remove</button></div>`).join("") : "<p class=\"daily-empty\">Your schedule is clear. Add something when you\'re ready.</p>";
}
function renderDailyEvents() {
  const el=document.getElementById("daily-events-list"); if(!el) return;
  const calendarEvents=eventsForDate(dailySelectedDate);
  const meals=(data.meals||[]).filter(x=>x.date===dailySelectedDate).map(x=>({title:`${x.type}: ${x.name}`,type:"meal",time:""}));
  const workouts=(data.workouts||[]).filter(x=>x.date===dailySelectedDate).map(x=>({title:`Workout: ${x.name}${x.duration?` (${x.duration} min)`:""}`,type:"workout",time:""}));
  const events=[...calendarEvents,...meals,...workouts];
  el.innerHTML=events.length ? events.map(item=>{
    const span=item.endDate && item.endDate!==item.date ? ` <small class="event-span-label">${niceDate(item.date)} – ${niceDate(item.endDate)}</small>` : "";
    return `<div class="daily-event-item"><span class="legend-dot ${escapeHTML(item.type)}"></span><span><strong>${item.time ? escapeHTML(item.time)+" · " : ""}${escapeHTML(item.title)}</strong>${span}<small>${escapeHTML(item.type)}</small></span></div>`;
  }).join("") : '<p class="daily-empty">No calendar events on this date.</p>';
}
function renderDailyTasks() {
  const el=document.getElementById("daily-tasks-list"); if(!el) return;
  const tasks=data.tasks.filter(t=>t.date===dailySelectedDate);
  el.innerHTML=tasks.length ? tasks.map(t=>`<label class="daily-task-item"><input type="checkbox" data-daily-task="${escapeHTML(t.id)}" ${t.done?"checked":""}><span class="${t.done?"daily-complete":""}">${escapeHTML(t.title)}</span></label>`).join("") : '<p class="daily-empty">No tasks are due on this date. Add a dated task in My tasks.</p>';
}
function renderDailyHabits() {
  const el=document.getElementById("daily-habits-list"); if(!el) return;
  const unique=[]; const seen=new Set();
  data.habits.filter(h=>habitIsDue(h,dailySelectedDate)||habitChecksFor(dailySelectedDate).has(h.id)).forEach(h=>{const key=(h.name||"").trim().toLowerCase(); if(key && !seen.has(key)){seen.add(key);unique.push(h);}});
  const checked=new Set(getDailyPlan().habitChecks);
  el.innerHTML=unique.length ? unique.map(h=>`<label class="daily-habit-item"><input type="checkbox" data-daily-habit="${escapeHTML(h.id)}" ${checked.has(h.id)?"checked":""}><span>${escapeHTML(h.name)}</span></label>`).join("") : '<p class="daily-empty">Add habits in the Habits section and they will appear here.</p>';
}
document.getElementById("daily-date").addEventListener("change", e=>{ if(e.target.value){dailySelectedDate=e.target.value;renderDailyPlanner();} });
document.getElementById("daily-today").addEventListener("click", ()=>{dailySelectedDate=today();renderDailyPlanner();});
[1,2,3].forEach((n,i)=>document.getElementById(`priority-${n}`).addEventListener("input",e=>{getDailyPlan().priorities[i]=e.target.value;saveDailyPlan();}));
["well","challenge","grateful"].forEach(k=>document.getElementById(`reflection-${k}`).addEventListener("input",e=>{getDailyPlan().reflection[k]=e.target.value;saveDailyPlan();}));
document.getElementById("schedule-form").addEventListener("submit",e=>{e.preventDefault();const time=document.getElementById("schedule-time"),activity=document.getElementById("schedule-activity");if(!time.value||!activity.value.trim())return;getDailyPlan().schedule.push({id:uid(),time:time.value,activity:activity.value.trim()});saveDailyPlan();renderDailySchedule();time.value="";activity.value="";toast("Added to your daily schedule");});
document.addEventListener("click",e=>{const remove=e.target.closest("[data-schedule-delete]");if(remove){const plan=getDailyPlan();plan.schedule=plan.schedule.filter(x=>x.id!==remove.dataset.scheduleDelete);saveDailyPlan();renderDailySchedule();}});
document.addEventListener("change",e=>{
  if(e.target.matches("[data-daily-task]")){const task=data.tasks.find(t=>t.id===e.target.dataset.dailyTask);if(task){task.done=e.target.checked;saveData();renderTasks();renderDailyTasks();renderCalendar();renderWeeklyReview();renderDashboardOverview();}}
  if(e.target.matches("[data-daily-habit]")){const id=e.target.dataset.dailyHabit;const checks=new Set(getDailyPlan().habitChecks);if(e.target.checked)checks.add(id);else checks.delete(id);getDailyPlan().habitChecks=[...checks];saveDailyPlan();}
});

// Weekly Review: saved separately for each Monday-to-Sunday week.
let weeklySelectedDate = today();
function weekKey(dateKeyValue) { return dateKey(startOfWeek(new Date(dateKeyValue + "T12:00:00"))); }
function getWeeklyReview() {
  data.weeklyReviews=data.weeklyReviews || {};
  const key=weekKey(weeklySelectedDate);
  if(!data.weeklyReviews[key]) data.weeklyReviews[key]={wins:"",challenges:"",improve:"",priorities:["","",""]};
  const review=data.weeklyReviews[key];
  review.priorities=Array.isArray(review.priorities)?review.priorities:["","",""];
  return review;
}
function saveWeeklyReview() {
  saveData();
  const status=document.getElementById("weekly-save-status");
  if(status) status.textContent="Saved on this device · "+new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}
function renderWeeklySpread(start) {
  const el=document.getElementById("weekly-spread-grid"); if(!el)return;
  el.innerHTML=Array.from({length:7},(_,i)=>{const d=addDays(start,i),key=dateKey(d),tasks=data.tasks.filter(t=>t.date===key),events=eventsForDate(key),meals=(data.meals||[]).filter(m=>m.date===key),workouts=(data.workouts||[]).filter(w=>w.date===key),plan=getDailyPlan(key),schedule=(plan.schedule||[]).slice().sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    return `<article class="weekly-spread-day"><header><strong>${d.toLocaleDateString(undefined,{weekday:"long"})}</strong><span>${d.toLocaleDateString(undefined,{day:"numeric",month:"short"})}</span></header><label class="weekly-focus-label">Daily focus<input data-week-focus="${key}" value="${escapeHTML(plan.weekFocus||"")}" placeholder="What matters today?"></label><div class="weekly-spread-items"><b>Tasks</b>${tasks.length?tasks.map(t=>`<label class="weekly-check-item"><input type="checkbox" data-week-task="${t.id}" ${t.done?"checked":""}><span class="${t.done?"is-done":""}">${escapeHTML(t.title)}</span></label>`).join(""):'<small>Nothing due</small>'}<b>Habits</b>${data.habits.filter(h=>habitIsDue(h,key)||habitChecksFor(key).has(h.id)).map(h=>`<label class="weekly-check-item"><input type="checkbox" data-week-habit="${key}" data-habit-id="${h.id}" ${habitChecksFor(key).has(h.id)?"checked":""}><span>${escapeHTML(h.name)}</span></label>`).join("")||'<small>No habits due</small>'}<b>Schedule & events</b>${schedule.map(x=>`<div class="weekly-schedule-row"><small>${escapeHTML(x.time)} · ${escapeHTML(x.activity)}</small><button type="button" data-week-schedule-delete="${key}" data-schedule-id="${x.id}" aria-label="Remove schedule item">×</button></div>`).join("")}${events.map(x=>`<small>✳ ${escapeHTML(x.title)}${x.time?" · "+escapeHTML(x.time):""}</small>`).join("")}${!schedule.length&&!events.length?'<small>Nothing scheduled</small>':''}<form class="weekly-schedule-form" data-week-schedule="${key}"><input name="time" type="time" aria-label="Time" required><input name="activity" maxlength="80" placeholder="Add time & activity" required><button type="submit" aria-label="Add schedule item">+</button></form><b>Meals & movement</b>${meals.map(x=>`<small>${escapeHTML(x.type)} · ${escapeHTML(x.name)}</small>`).join("")}${workouts.map(x=>`<small>Movement · ${escapeHTML(x.name)}</small>`).join("")}${!meals.length&&!workouts.length?'<small>Not planned yet</small>':''}</div><button type="button" class="text-button weekly-open-day" data-week-open-day="${key}">Open daily planner ↗</button></article>`;
  }).join("");
}
function renderWeeklyReview() {
  const dateInput=document.getElementById("weekly-date"); if(!dateInput) return;
  dateInput.value=weeklySelectedDate;
  const start=new Date(weekKey(weeklySelectedDate)+"T12:00:00"), end=addDays(start,6);
  const startKey=dateKey(start), endKey=dateKey(end);
  document.getElementById("weekly-range-label").textContent=`${dateLabel(startKey,{day:"numeric",month:"short"})} – ${dateLabel(endKey,{day:"numeric",month:"short",year:"numeric"})}`;
  const weekTasks=data.tasks.filter(t=>t.date && t.date>=startKey && t.date<=endKey);
  const completed=weekTasks.filter(t=>t.done).length;
  document.getElementById("weekly-completed").textContent=completed;
  document.getElementById("weekly-outstanding").textContent=weekTasks.length-completed;
  document.getElementById("weekly-task-total").textContent=`${weekTasks.length} dated task${weekTasks.length===1?"":"s"} this week`;
  const unfinished=weekTasks.filter(t=>!t.done);
  const carryEl=document.getElementById("weekly-carry-list");
  carryEl.innerHTML=unfinished.length?unfinished.map(t=>`<label class="weekly-carry-item"><input type="checkbox" data-carry-task="${escapeHTML(t.id)}"><span>${escapeHTML(t.title)}</span><small>${niceDate(t.date)}</small></label>`).join(""):'<p class="daily-empty">You have no unfinished dated tasks this week.</p>';
  document.getElementById("carry-tasks-button").disabled=!unfinished.length;
  let habitDone=0, habitDue=0;
  data.habits.forEach(h=>{const count=habitCompletionCount(h,startKey);habitDone+=Math.min(count,habitTarget(h));habitDue+=habitTarget(h);});
  document.getElementById("weekly-habits").textContent=`${habitDone} / ${habitDue}`;
  const events=[]; for(let i=0;i<7;i++){const key=dateKey(addDays(start,i));eventsForDate(key).forEach(ev=>events.push({...ev,day:key}));}
  const eventEl=document.getElementById("weekly-events-list");
  eventEl.innerHTML=events.length?events.map(ev=>`<div class="weekly-event-row"><span class="legend-dot ${escapeHTML(ev.type)}"></span><span><strong>${escapeHTML(ev.title)}</strong><small>${dateLabel(ev.day,{weekday:"short",day:"numeric",month:"short"})}${ev.time?" · "+escapeHTML(ev.time):""}</small></span></div>`).join(""):'<p class="daily-empty">No calendar events scheduled for this week.</p>';
  const review=getWeeklyReview();
  [["weekly-wins",review.wins],["weekly-challenges",review.challenges],["weekly-improve",review.improve]].forEach(([id,value])=>document.getElementById(id).value=value||"");
  [1,2,3].forEach((n,i)=>document.getElementById(`weekly-priority-${n}`).value=review.priorities[i]||"");
  renderWeeklySpread(start);
  const overview=document.getElementById("weekly-overview-grid");
  if(overview) overview.innerHTML=Array.from({length:7},(_,i)=>{const d=addDays(start,i),key=dateKey(d),tasks=data.tasks.filter(t=>t.date===key),events=eventsForDate(key),meals=(data.meals||[]).filter(m=>m.date===key),workouts=(data.workouts||[]).filter(w=>w.date===key);return `<div class="weekly-day-card"><strong>${d.toLocaleDateString(undefined,{weekday:"short"})}</strong><small>${d.getDate()} ${d.toLocaleDateString(undefined,{month:"short"})}</small><div>${tasks.map(t=>`<span class="weekly-mini-item ${t.done?'is-done':''}">☐ ${escapeHTML(t.title)}</span>`).join("")}${events.map(ev=>`<span class="weekly-mini-item">✳ ${escapeHTML(ev.title)}</span>`).join("")}${meals.map(m=>`<span class="weekly-mini-item">Meal: ${escapeHTML(m.name)}</span>`).join("")}${workouts.map(w=>`<span class="weekly-mini-item">Move: ${escapeHTML(w.name)}</span>`).join("")}${!tasks.length&&!events.length&&!meals.length&&!workouts.length?'<span class="weekly-mini-empty">Nothing planned</span>':''}</div></div>`}).join("");
}
document.getElementById("weekly-date").addEventListener("change",e=>{if(e.target.value){weeklySelectedDate=e.target.value;renderWeeklyReview();}});
document.getElementById("weekly-prev").addEventListener("click",()=>{weeklySelectedDate=dateKey(addDays(new Date(weeklySelectedDate+"T12:00:00"),-7));renderWeeklyReview();});
document.getElementById("weekly-next").addEventListener("click",()=>{weeklySelectedDate=dateKey(addDays(new Date(weeklySelectedDate+"T12:00:00"),7));renderWeeklyReview();});
document.getElementById("weekly-today").addEventListener("click",()=>{weeklySelectedDate=today();renderWeeklyReview();});
document.getElementById("carry-tasks-button").addEventListener("click",()=>{
  const selected=[...document.querySelectorAll("[data-carry-task]:checked")].map(el=>el.dataset.carryTask);
  if(!selected.length){toast("Select at least one task to move");return;}
  selected.forEach(id=>{const task=data.tasks.find(t=>t.id===id);if(task&&task.date){task.date=dateKey(addDays(new Date(task.date+"T12:00:00"),7));}});
  saveData();renderTasks();renderCalendar();renderWeeklyReview();toast(`${selected.length} task${selected.length===1?"":"s"} moved to next week`);
});
["wins","challenges","improve"].forEach(k=>document.getElementById(`weekly-${k}`).addEventListener("input",e=>{getWeeklyReview()[k]=e.target.value;saveWeeklyReview();}));
[1,2,3].forEach((n,i)=>document.getElementById(`weekly-priority-${n}`).addEventListener("input",e=>{getWeeklyReview().priorities[i]=e.target.value;saveWeeklyReview();}));

// Monthly planning: each month has its own focus, priorities and reflection.
let monthlySelected = today().slice(0,7);
function monthPlanKey(){ return monthlySelected; }
function getMonthlyPlan(){
  data.monthlyPlans=data.monthlyPlans||{};
  const key=monthPlanKey();
  if(!data.monthlyPlans[key]) data.monthlyPlans[key]={focus:"",priorities:["","",""],wins:"",carry:""};
  const plan=data.monthlyPlans[key];
  if(!Array.isArray(plan.priorities)) plan.priorities=["","",""];
  return plan;
}
function saveMonthlyPlan(){
  saveData();
  const status=document.getElementById("monthly-save-status");
  if(status) status.textContent="Saved on this device · "+new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}
function renderMonthlyPlanner(){
  const input=document.getElementById("monthly-date"); if(!input) return;
  input.value=monthlySelected;
  const [year,month]=monthlySelected.split("-").map(Number);
  const first=new Date(year,month-1,1), last=new Date(year,month,0);
  document.getElementById("monthly-range-label").textContent=first.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const start=dateKey(first), end=dateKey(last);
  const tasks=data.tasks.filter(t=>t.date && t.date>=start && t.date<=end);
  const done=tasks.filter(t=>t.done).length;
  const eventRows=[]; const busy=new Set();
  for(let d=1;d<=last.getDate();d++){
    const key=dateKey(new Date(year,month-1,d));
    const dayEvents=eventsForDate(key);
    dayEvents.forEach(ev=>eventRows.push({...ev,day:key}));
    if(dayEvents.length || tasks.some(t=>t.date===key)) busy.add(key);
  }
  document.getElementById("monthly-completed").textContent=done;
  document.getElementById("monthly-task-total").textContent=`${tasks.length} task${tasks.length===1?"":"s"} scheduled`;
  document.getElementById("monthly-event-total").textContent=eventRows.length;
  document.getElementById("monthly-busy-days").textContent=busy.size;
  const eventsEl=document.getElementById("monthly-events-list");
  eventsEl.innerHTML=eventRows.length?eventRows.sort((a,b)=>a.day.localeCompare(b.day)||(a.time||"").localeCompare(b.time||"")).slice(0,14).map(ev=>`<div class="monthly-list-row"><span class="legend-dot ${escapeHTML(ev.type)}"></span><span><strong>${escapeHTML(ev.title)}</strong><small>${dateLabel(ev.day,{weekday:"short",day:"numeric",month:"short"})}${ev.time?" · "+escapeHTML(ev.time):""}</small></span></div>`).join(""):'<p class="daily-empty">No events planned this month yet.</p>';
  const tasksEl=document.getElementById("monthly-tasks-list");
  tasksEl.innerHTML=tasks.length?tasks.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,14).map(t=>`<label class="monthly-task-row"><input type="checkbox" data-monthly-task="${escapeHTML(t.id)}" ${t.done?"checked":""}><span class="${t.done?"daily-complete":""}">${escapeHTML(t.title)}</span><small>${niceDate(t.date)}</small></label>`).join(""):'<p class="daily-empty">No dated tasks this month. Add tasks with due dates to see them here.</p>';
  const plan=getMonthlyPlan();
  document.getElementById("monthly-focus").value=plan.focus||"";
  [1,2,3].forEach((n,i)=>document.getElementById(`monthly-priority-${n}`).value=plan.priorities[i]||"");
  document.getElementById("monthly-wins").value=plan.wins||"";
  document.getElementById("monthly-carry").value=plan.carry||"";
}
document.getElementById("monthly-date").addEventListener("change",e=>{if(e.target.value){monthlySelected=e.target.value;renderMonthlyPlanner();}});
document.getElementById("monthly-prev").addEventListener("click",()=>{const [y,m]=monthlySelected.split("-").map(Number);const d=new Date(y,m-2,1);monthlySelected=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;renderMonthlyPlanner();});
document.getElementById("monthly-next").addEventListener("click",()=>{const [y,m]=monthlySelected.split("-").map(Number);const d=new Date(y,m,1);monthlySelected=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;renderMonthlyPlanner();});
document.getElementById("monthly-today").addEventListener("click",()=>{monthlySelected=today().slice(0,7);renderMonthlyPlanner();});
document.getElementById("monthly-focus").addEventListener("input",e=>{getMonthlyPlan().focus=e.target.value;saveMonthlyPlan();});
[1,2,3].forEach((n,i)=>document.getElementById(`monthly-priority-${n}`).addEventListener("input",e=>{getMonthlyPlan().priorities[i]=e.target.value;saveMonthlyPlan();}));
document.getElementById("monthly-wins").addEventListener("input",e=>{getMonthlyPlan().wins=e.target.value;saveMonthlyPlan();});
document.getElementById("monthly-carry").addEventListener("input",e=>{getMonthlyPlan().carry=e.target.value;saveMonthlyPlan();});
document.addEventListener("change",e=>{if(e.target.matches("[data-monthly-task]")){const task=data.tasks.find(t=>t.id===e.target.dataset.monthlyTask);if(task){task.done=e.target.checked;saveData();renderMonthlyPlanner();renderTasks();renderCalendar();renderDashboardOverview();}}});


// Additional life-management modules
const listFor = key => Array.isArray(data[key]) ? data[key] : (data[key]=[]);
const wellnessDay = () => document.getElementById("wellness-date").value || today();
function renderLifeSections(){
 const meals=listFor("meals");document.getElementById("meal-list").innerHTML=meals.length?meals.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.name)}</strong><small>${niceDate(x.date)} · ${escapeHTML(x.type)}</small></span><button class="delete-button" data-life-delete="meals" data-id="${x.id}">×</button></div>`).join(""):'<p class="empty-hint">Your meal plan is empty.</p>';
 const recipes=listFor("recipes");const recipeList=document.getElementById("recipe-list");if(recipeList)recipeList.innerHTML=recipes.length?recipes.map(r=>`<div class="recipe-card"><div><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML((r.ingredients||[]).join(", "))}</small>${r.instructions?`<p>${escapeHTML(r.instructions)}</p>`:""}</div><div class="recipe-actions"><input type="date" data-recipe-date="${r.id}" value="${today()}" aria-label="Date to plan recipe"><button class="secondary-button" type="button" data-plan-recipe="${r.id}">Add to meal plan</button><button class="delete-button" type="button" data-delete-recipe="${r.id}">×</button></div></div>`).join(""):'<p class="empty-hint">Save recipes here to reuse them in your weekly meal plan.</p>';
 const groceries=listFor("groceries");document.getElementById("grocery-list").innerHTML=groceries.length?groceries.map(x=>`<div class="life-row ${x.done?'life-done':''}"><label><input type="checkbox" data-grocery="${x.id}" ${x.done?'checked':''}> ${escapeHTML(x.name)}</label><button class="delete-button" data-life-delete="groceries" data-id="${x.id}">×</button></div>`).join(""):'<p class="empty-hint">Your grocery list is clear.</p>';
 const chores=listFor("cleaning");document.getElementById("cleaning-list").innerHTML=chores.length?chores.map(x=>`<div class="life-row"><label><input type="checkbox" data-cleaning="${x.id}" ${x.done?'checked':''}> ${escapeHTML(x.name)}<small>${escapeHTML(x.frequency)} · ${x.done?'Done':'To do'}</small></label><button class="delete-button" data-life-delete="cleaning" data-id="${x.id}">×</button></div>`).join(""):'<p class="empty-hint">Add a chore to build your routine.</p>';
 const projects=listFor("projects");document.getElementById("project-empty").hidden=projects.length>0;document.getElementById("project-list").innerHTML=projects.map(x=>`<article class="project-card"><div class="project-card-top"><div><h2>${escapeHTML(x.name)}</h2><small>${x.date?'Target: '+niceDate(x.date):'No target date'}</small></div><button class="delete-button" data-life-delete="projects" data-id="${x.id}">×</button></div><label class="project-next">Next step<input data-project-next="${x.id}" value="${escapeHTML(x.next||'')}" placeholder="Add the next action..."></label><div class="project-progress"><label>Status<select data-project-status="${x.id}"><option ${x.status==='Planning'?'selected':''}>Planning</option><option ${x.status==='In progress'?'selected':''}>In progress</option><option ${x.status==='On hold'?'selected':''}>On hold</option><option ${x.status==='Completed'?'selected':''}>Completed</option></select></label><label>Progress <strong>${x.progress||0}%</strong><input type="range" min="0" max="100" step="5" value="${x.progress||0}" data-project-progress="${x.id}"></label></div><form class="project-task-form" data-project-task-form="${x.id}"><input name="title" maxlength="100" placeholder="Add a project task..." required><input name="date" type="date" aria-label="Task due date"><button class="secondary-button">Add task</button></form><div class="project-linked-tasks">${data.tasks.filter(t=>t.projectId===x.id).map(t=>`<label class="life-row"><span><input type="checkbox" data-project-task-check="${t.id}" ${t.done?'checked':''}> ${escapeHTML(t.title)}${t.date?` <small>Due ${niceDate(t.date)}</small>`:''}</span></label>`).join("")}</div></article>`).join("");
 const collections=listFor("collections");document.getElementById("collection-empty").hidden=collections.length>0;document.getElementById("collection-list").innerHTML=collections.map(x=>`<article class="collection-card"><div class="project-card-top"><h2>${escapeHTML(x.name)}</h2><button class="delete-button" data-life-delete="collections" data-id="${x.id}">×</button></div><form class="collection-item-form" data-collection-form="${x.id}"><input name="item" maxlength="120" placeholder="Add an item..." required><button class="secondary-button" type="submit">Add</button></form><div class="life-list">${x.items.map((item,i)=>`<div class="life-row ${item.done?'life-done':''}"><label><input type="checkbox" data-collection-check="${x.id}" data-index="${i}" ${item.done?'checked':''}> ${escapeHTML(item.name)}</label><button class="delete-button" data-collection-delete="${x.id}" data-index="${i}">×</button></div>`).join("")}</div></article>`).join("");
 const records=listFor("homeRecords");document.getElementById("home-record-list").innerHTML=records.length?records.map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.name)}</strong><small>${escapeHTML(x.type)}${x.date?" · "+niceDate(x.date):""}${x.details?" · "+escapeHTML(x.details):""}</small></span><button class="delete-button" data-life-delete="homeRecords" data-id="${x.id}">×</button></div>`).join(""):'<p class="empty-hint">Keep appliance details, maintenance reminders and useful contacts here.</p>';
 renderWellness();
}
function renderWellness(){
 const day=wellnessDay(),entry=(data.wellness||{})[day]||{};["mood","energy","sleep","water","note"].forEach(k=>document.getElementById("wellness-"+k).value=entry[k]??"");
 const foods=listFor("foodLogs").filter(x=>x.date===day),workouts=listFor("workouts").filter(x=>x.date===day);
 document.getElementById("food-list").innerHTML=foods.length?foods.map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.name)}</strong><small>${escapeHTML(x.type)}</small></span><button class="delete-button" data-life-delete="foodLogs" data-id="${x.id}">×</button></div>`).join(""):'<p class="empty-hint">No food entries for this day.</p>';
 document.getElementById("workout-list").innerHTML=workouts.length?workouts.map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.name)}</strong><small>${x.duration?x.duration+' minutes':'Duration not set'}</small></span><button class="delete-button" data-life-delete="workouts" data-id="${x.id}">×</button></div>`).join(""):'<p class="empty-hint">Your movement log will appear here.</p>';
 const rows=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(29-i));const key=dateKey(d),v=data.wellness?.[key]||{};return {d,key,v};});
 const sleep=rows.filter(x=>x.v.sleep!==""&&x.v.sleep!=null).map(x=>Number(x.v.sleep)).filter(Number.isFinite),water=rows.filter(x=>x.v.water!==""&&x.v.water!=null).map(x=>Number(x.v.water)).filter(Number.isFinite);
 const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):"—";
 document.getElementById("wellness-summary").innerHTML=`<div class="wellness-summary-card"><span>Average sleep</span><strong>${avg(sleep)}${sleep.length?" h":""}</strong><small>${sleep.length} recorded days</small></div><div class="wellness-summary-card"><span>Average water</span><strong>${avg(water)}${water.length?" glasses":""}</strong><small>${water.length} recorded days</small></div><div class="wellness-summary-card"><span>Mood check-ins</span><strong>${rows.filter(x=>x.v.mood).length}</strong><small>Out of 30 days</small></div>`;
 const moodScore={Low:1,Okay:2,Good:3,Great:4};
 document.getElementById("wellness-trends").innerHTML=`<div class="wellness-chart-heading"><span>30-day mood trend</span><small>Blank days mean no check-in was recorded</small></div><div class="wellness-mood-bars">${rows.map(x=>`<div class="wellness-mood-bar-wrap" title="${dateLabel(x.key,{day:"numeric",month:"short"})}: ${x.v.mood||"No check-in"}"><span class="wellness-mood-bar mood-${(x.v.mood||"none").toLowerCase()}" style="height:${x.v.mood?(moodScore[x.v.mood]*22):"4"}px"></span></div>`).join("")}</div><div class="wellness-chart-legend"><span>Low</span><span>Okay</span><span>Good</span><span>Great</span></div><div class="wellness-trend-table">${rows.slice(-7).reverse().map(x=>`<div class="wellness-trend-row"><strong>${x.d.toLocaleDateString(undefined,{weekday:"short",day:"numeric"})}</strong><span>Mood: ${escapeHTML(x.v.mood||"—")}</span><span>Energy: ${escapeHTML(x.v.energy||"—")}</span><span>Sleep: ${x.v.sleep?escapeHTML(x.v.sleep)+" h":"—"}</span><span>Water: ${x.v.water?escapeHTML(x.v.water)+" glasses":"—"}</span></div>`).join("")}</div>`;
}
function saveWellness(e){const key=e.target.id.replace("wellness-","");if(!["mood","energy","sleep","water","note"].includes(key))return;data.wellness=data.wellness||{};data.wellness[wellnessDay()]=data.wellness[wellnessDay()]||{};data.wellness[wellnessDay()][key]=e.target.value;saveData();}
document.getElementById("meal-day").value=today();document.getElementById("wellness-date").value=today();
document.getElementById("meal-form").addEventListener("submit",e=>{e.preventDefault();const ingredients=document.getElementById("meal-ingredients").value.split(",").map(x=>x.trim()).filter(Boolean);listFor("meals").push({id:uid(),date:document.getElementById("meal-day").value,type:document.getElementById("meal-type").value,name:document.getElementById("meal-name").value.trim(),ingredients});ingredients.forEach(name=>{if(!listFor("groceries").some(g=>g.name.toLowerCase()===name.toLowerCase()&&!g.done))listFor("groceries").push({id:uid(),name,done:false,fromMeal:true});});saveData();e.target.reset();document.getElementById("meal-day").value=today();renderLifeSections();renderDailyPlanner();renderWeeklyReview();renderDashboardOverview();});
document.getElementById("recipe-form").addEventListener("submit",e=>{e.preventDefault();const ingredients=document.getElementById("recipe-ingredients").value.split(",").map(x=>x.trim()).filter(Boolean);listFor("recipes").push({id:uid(),name:document.getElementById("recipe-name").value.trim(),ingredients,instructions:document.getElementById("recipe-instructions").value.trim()});saveData();e.target.reset();renderLifeSections();toast("Recipe saved");});
document.getElementById("grocery-form").addEventListener("submit",e=>{e.preventDefault();listFor("groceries").push({id:uid(),name:document.getElementById("grocery-name").value.trim(),done:false});saveData();e.target.reset();renderLifeSections();});
document.getElementById("cleaning-form").addEventListener("submit",e=>{e.preventDefault();listFor("cleaning").push({id:uid(),name:document.getElementById("cleaning-name").value.trim(),frequency:document.getElementById("cleaning-frequency").value,done:false});saveData();e.target.reset();renderLifeSections();});
document.getElementById("project-form").addEventListener("submit",e=>{e.preventDefault();listFor("projects").push({id:uid(),name:document.getElementById("project-name").value.trim(),date:document.getElementById("project-date").value,next:document.getElementById("project-next").value.trim(),status:"Planning",progress:0});saveData();e.target.reset();renderLifeSections();});
document.getElementById("collection-form").addEventListener("submit",e=>{e.preventDefault();listFor("collections").push({id:uid(),name:document.getElementById("collection-name").value.trim(),items:[]});saveData();e.target.reset();renderLifeSections();});
document.getElementById("food-form").addEventListener("submit",e=>{e.preventDefault();listFor("foodLogs").push({id:uid(),date:wellnessDay(),type:document.getElementById("food-type").value,name:document.getElementById("food-name").value.trim()});saveData();e.target.reset();renderWellness();});
document.getElementById("workout-form").addEventListener("submit",e=>{e.preventDefault();listFor("workouts").push({id:uid(),date:wellnessDay(),name:document.getElementById("workout-name").value.trim(),duration:document.getElementById("workout-duration").value});saveData();e.target.reset();renderWellness();renderDailyPlanner();renderWeeklyReview();renderDashboardOverview();});
document.getElementById("wellness-date").addEventListener("change",renderWellness);
document.addEventListener("input",e=>{if(e.target.matches("[data-week-focus]")){const key=e.target.dataset.weekFocus;data.weeklyPlans=data.weeklyPlans||{};data.weeklyPlans[key]=data.weeklyPlans[key]||{};data.weeklyPlans[key].focus=e.target.value;saveData();return;}if(e.target.matches("[data-project-next]")){const x=listFor("projects").find(v=>v.id===e.target.dataset.projectNext);if(x){x.next=e.target.value;saveData();}}});
document.addEventListener("change",e=>{if(e.target.matches("[data-week-habit]")){const key=e.target.dataset.weekHabit,id=e.target.dataset.habitId,checks=habitChecksFor(key);e.target.checked?checks.add(id):checks.delete(id);getDailyPlan(key).habitChecks=[...checks];saveData();renderWeeklyReview();renderHabits();return;}if(e.target.matches("[data-week-task]")){const task=data.tasks.find(t=>t.id===e.target.dataset.weekTask);if(task){task.done=e.target.checked;saveData();renderTasks();renderWeeklyReview();renderDashboardOverview();}return;}if(e.target.matches("[data-grocery]")){const x=listFor("groceries").find(v=>v.id===e.target.dataset.grocery);if(x)x.done=e.target.checked;saveData();renderLifeSections();}if(e.target.matches("[data-cleaning]")){const x=listFor("cleaning").find(v=>v.id===e.target.dataset.cleaning);if(x)x.done=e.target.checked;saveData();renderLifeSections();}if(e.target.matches("[data-project-status]")){const x=listFor("projects").find(v=>v.id===e.target.dataset.projectStatus);if(x){x.status=e.target.value;if(x.status==="Completed")x.progress=100;saveData();renderLifeSections();}}if(e.target.matches("[data-project-progress]")){const x=listFor("projects").find(v=>v.id===e.target.dataset.projectProgress);if(x){x.progress=Number(e.target.value);if(x.progress===100)x.status="Completed";saveData();renderLifeSections();}}if(e.target.matches("[data-collection-check]")){const x=listFor("collections").find(v=>v.id===e.target.dataset.collectionCheck);if(x&&x.items[Number(e.target.dataset.index)])x.items[Number(e.target.dataset.index)].done=e.target.checked;saveData();renderLifeSections();}if(e.target.id.startsWith("wellness-"))saveWellness(e);});
document.addEventListener("click",e=>{const weekScheduleDelete=e.target.closest("[data-week-schedule-delete]");if(weekScheduleDelete){const plan=getDailyPlan(weekScheduleDelete.dataset.weekScheduleDelete);plan.schedule=plan.schedule.filter(x=>x.id!==weekScheduleDelete.dataset.scheduleId);saveData();renderWeeklyReview();return;}const planRecipe=e.target.closest("[data-plan-recipe]");if(planRecipe){const recipe=listFor("recipes").find(x=>x.id===planRecipe.dataset.planRecipe);const dateInput=document.querySelector(`[data-recipe-date="${planRecipe.dataset.planRecipe}"]`);if(recipe){const date=dateInput?.value||today();listFor("meals").push({id:uid(),date,type:"Dinner",name:recipe.name,ingredients:[...(recipe.ingredients||[])]});(recipe.ingredients||[]).forEach(name=>{if(!listFor("groceries").some(g=>g.name.toLowerCase()===name.toLowerCase()&&!g.done))listFor("groceries").push({id:uid(),name,done:false,fromMeal:true});});saveData();renderLifeSections();renderDailyPlanner();renderWeeklyReview();renderDashboardOverview();toast("Recipe added to meals and groceries");}return;}const deleteRecipe=e.target.closest("[data-delete-recipe]");if(deleteRecipe){data.recipes=listFor("recipes").filter(x=>x.id!==deleteRecipe.dataset.deleteRecipe);saveData();renderLifeSections();return;}const openWeekDay=e.target.closest("[data-week-open-day]");if(openWeekDay){dailySelectedDate=openWeekDay.dataset.weekOpenDay;showView("daily");renderDailyPlanner();return;}const del=e.target.closest("[data-life-delete]");if(del){const key=del.dataset.lifeDelete;data[key]=listFor(key).filter(x=>x.id!==del.dataset.id);saveData();renderLifeSections();return;}const item=e.target.closest("[data-collection-delete]");if(item){const x=listFor("collections").find(v=>v.id===item.dataset.collectionDelete);if(x)x.items.splice(Number(item.dataset.index),1);saveData();renderLifeSections();}});
document.addEventListener("submit",e=>{const form=e.target.closest("[data-collection-form]");if(!form)return;e.preventDefault();const x=listFor("collections").find(v=>v.id===form.dataset.collectionForm),input=form.elements.item;if(x&&input.value.trim()){x.items.push({name:input.value.trim(),done:false});saveData();renderLifeSections();}});


// Connected life-management tools: yearly planning, routines, finance, travel, search and backups.
const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
function renderAdvancedSections(){
 const yearInput=document.getElementById("yearly-year");if(!yearInput)return;
 const year=Number(yearInput.value)||new Date().getFullYear();yearInput.value=year;
 data.yearlyPlans=data.yearlyPlans||{};const plan=data.yearlyPlans[year]||{theme:"",goals:["","",""]};
 document.getElementById("yearly-theme").value=plan.theme||"";[1,2,3].forEach((n,i)=>document.getElementById(`year-goal-${n}`).value=plan.goals?.[i]||"");
 const milestones=(data.milestones||[]).filter(x=>x.date&&x.date.startsWith(String(year))).sort((a,b)=>a.date.localeCompare(b.date));
 document.getElementById("milestone-list").innerHTML=milestones.length?milestones.map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.name)}</strong><small>${niceDate(x.date)}</small></span><button class="delete-button" data-delete-milestone="${x.id}">×</button></div>`).join(""):'<p class="empty-hint">Add birthdays, holidays, deadlines and special dates.</p>';
 document.getElementById("year-month-grid").innerHTML=monthNames.map((m,i)=>{const key=`${year}-${String(i+1).padStart(2,"0")}`,mp=data.monthlyPlans?.[key]||{};const count=(data.events||[]).filter(e=>(e.date||e.startDate||"").startsWith(key)).length;return `<button class="year-month-card" type="button" data-open-month="${key}"><strong>${m}</strong><small>${escapeHTML(mp.focus||"Add a monthly focus")}</small><span>${count} event${count===1?"":"s"}</span></button>`}).join("");
 const dayOfWeek=new Date(today()+"T12:00:00").getDay();const routines=data.routines||[];document.getElementById("routine-list").innerHTML=routines.length?routines.map(r=>{r.steps=r.steps||[];r.doneDate=r.doneDate||"";const done=r.doneDate===today(),frequency=r.frequency||"daily",due=frequency==="daily"||(frequency==="weekdays"&&dayOfWeek>=1&&dayOfWeek<=5)||(frequency==="weekends"&&(dayOfWeek===0||dayOfWeek===6))||(frequency==="weekly"&&dayOfWeek===1);return `<article class="routine-card"><div class="project-card-top"><div><h2>${escapeHTML(r.name)}</h2><small>${escapeHTML(r.time)} · ${escapeHTML(r.frequency||"daily")}</small></div><button class="delete-button" data-delete-routine="${r.id}">×</button></div><form class="routine-step-form" data-routine-step-form="${r.id}"><input name="step" maxlength="100" placeholder="Add a step..." required><button class="secondary-button">Add</button></form><div class="life-list">${r.steps.map((s,i)=>`<label class="life-row"><span><input type="checkbox" data-routine-check="${r.id}" data-index="${i}" ${done&&s.done?'checked':''} ${!due?'disabled':''}> ${escapeHTML(s.name)}</span><button type="button" class="delete-button" data-routine-delete-step="${r.id}" data-index="${i}">×</button></label>`).join("")}</div><small class="routine-progress">${done?r.steps.filter(s=>s.done).length:0} / ${r.steps.length} steps completed today · ${due?'Due today':'Not scheduled today'}</small></article>`}).join(""):'<p class="empty-hint">Create a morning, evening or weekly routine to get started.</p>';
 const month=today().slice(0,7),tx=(data.finance||[]).filter(x=>(x.date||"").startsWith(month));const income=tx.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0),expenses=tx.filter(x=>x.type!=="income").reduce((s,x)=>s+Number(x.amount),0),budget=Number(data.financeBudget||0);
 document.getElementById("finance-budget").value=data.financeBudget??"";document.getElementById("finance-income").textContent=money(income);document.getElementById("finance-expenses").textContent=money(expenses);document.getElementById("finance-remaining").textContent=money((budget||income)-expenses);
 document.getElementById("finance-list").innerHTML=tx.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.description)}</strong><small>${escapeHTML(x.category||x.type)} · ${niceDate(x.date)}</small></span><strong>${x.type==="income"?"+":"−"}${money(Number(x.amount))}</strong><button class="delete-button" data-delete-finance="${x.id}">×</button></div>`).join("")||'<p class="empty-hint">No transactions recorded this month.</p>';
 const trips=data.trips||[];document.getElementById("trip-list").innerHTML=trips.length?trips.map(t=>`<article class="trip-card"><div class="project-card-top"><div><h2>${escapeHTML(t.name)}</h2><small>${escapeHTML(t.destination)} · ${t.start?niceDate(t.start):"Date not set"}${t.end?" – "+niceDate(t.end):""}</small></div><button class="delete-button" data-delete-trip="${t.id}">×</button></div><p>${escapeHTML(t.notes||"")}</p><form class="trip-pack-form" data-trip-pack-form="${t.id}"><input name="item" maxlength="100" placeholder="Add packing item..." required><button class="secondary-button">Add</button></form><div class="life-list">${(t.packing||[]).map((x,i)=>`<label class="life-row"><span><input type="checkbox" data-trip-pack-check="${t.id}" data-index="${i}" ${x.done?'checked':''}> ${escapeHTML(x.name)}</span><button class="delete-button" type="button" data-trip-pack-delete="${t.id}" data-index="${i}">×</button></label>`).join("")}</div></article>`).join(""):'<p class="empty-hint">Your planned trips will appear here.</p>';
 document.getElementById("saving-list").innerHTML=(data.savingsGoals||[]).map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.name)}</strong><small>Target ${money(x.target)}</small></span><button class="delete-button" data-delete-saving="${x.id}">×</button></div>`).join("")||'<p class="empty-hint">Add a savings goal to keep it visible.</p>';
 document.getElementById("subscription-list").innerHTML=(data.subscriptions||[]).map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.name)}</strong><small>${money(x.amount)} · ${escapeHTML(x.frequency)}</small></span><button class="delete-button" data-delete-subscription="${x.id}">×</button></div>`).join("")||'<p class="empty-hint">Track recurring bills and subscriptions here.</p>';
 const tripSelect=document.getElementById("itinerary-trip");tripSelect.innerHTML=trips.map(t=>`<option value="${t.id}">${escapeHTML(t.name)}</option>`).join("");
 const itinerary=(data.itinerary||[]).slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.time||"").localeCompare(b.time||""));document.getElementById("itinerary-list").innerHTML=itinerary.map(x=>`<div class="life-row"><span><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(trips.find(t=>t.id===x.tripId)?.name||"Trip")}${x.date?" · "+niceDate(x.date):""}${x.time?" · "+escapeHTML(x.time):""}</small></span><button class="delete-button" data-delete-itinerary="${x.id}">×</button></div>`).join("")||'<p class="empty-hint">Add flights, bookings, activities and travel plans to your itinerary.</p>';
 document.getElementById("planner-theme").value=data.plannerTheme||"earth";document.body.dataset.theme=data.plannerTheme||"earth";
 renderDashboardSettings();
}
function money(n){return new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(n)||0)}
function applyDashboardOrder(){const grid=document.querySelector("#dashboard-view .content-grid");if(!grid)return;const order=data.dashboardOrder||[];const cards=[...grid.querySelectorAll("[data-dashboard-card]")];cards.sort((a,b)=>{const ai=order.indexOf(a.dataset.dashboardCard),bi=order.indexOf(b.dataset.dashboardCard);return (ai<0?999:ai)-(bi<0?999:bi);}).forEach(card=>grid.appendChild(card));}
function renderDashboardSettings(){const names={tasks:"Today's tasks",habits:"Daily habits",checkin:"Daily check-in",upcoming:"Upcoming events",todaylife:"Meals, movement & priorities",intention:"Today's intention"};const el=document.getElementById("dashboard-settings");if(!el)return;el.innerHTML=Object.entries(names).map(([k,v],i)=>`<div class="dashboard-setting-row"><label><input type="checkbox" data-dashboard-toggle="${k}" ${!(data.dashboardHidden||[]).includes(k)?"checked":""}> ${v}</label><span class="dashboard-move-controls"><button type="button" data-dashboard-move="${k}" data-direction="up" aria-label="Move ${v} up">↑</button><button type="button" data-dashboard-move="${k}" data-direction="down" aria-label="Move ${v} down">↓</button></span></div>`).join("");document.querySelectorAll("[data-dashboard-card]").forEach(card=>card.hidden=(data.dashboardHidden||[]).includes(card.dataset.dashboardCard));applyDashboardOrder();const carry=document.getElementById("auto-carry-tasks");if(carry)carry.checked=!!data.autoCarryTasks;}
function runSearch(query){const q=(query||"").trim().toLowerCase(),out=document.getElementById("search-results");if(!out)return;if(!q){out.innerHTML="";return;}const found=[];const add=(type,name,detail,view)=>{if((name+" "+(detail||"")).toLowerCase().includes(q))found.push({type,name,detail,view});};(data.tasks||[]).forEach(x=>add("Task",x.title,x.date,"tasks"));(data.goals||[]).forEach(x=>add("Goal",x.name,x.category||"","goals"));(data.habits||[]).forEach(x=>add("Habit",x.name,x.frequency||"","habits"));(data.meals||[]).forEach(x=>add("Meal",x.name,x.date||"","home"));(data.projects||[]).forEach(x=>add("Project",x.name,x.next,"projects"));(data.collections||[]).forEach(x=>{add("List",x.name,"", "collections");(x.items||[]).forEach(i=>add("List item",i.name,x.name,"collections"));});(data.trips||[]).forEach(x=>add("Trip",x.name,x.destination,"travel"));(data.recipes||[]).forEach(x=>add("Recipe",x.name,(x.ingredients||[]).join(", "),"home"));(data.milestones||[]).forEach(x=>add("Milestone",x.name,x.date,"yearly"));(data.homeRecords||[]).forEach(x=>add(x.type,x.name,x.details,"home"));(data.subscriptions||[]).forEach(x=>add("Subscription",x.name,x.frequency,"finance"));(data.savingsGoals||[]).forEach(x=>add("Savings goal",x.name,money(x.target),"finance"));(data.itinerary||[]).forEach(x=>add("Itinerary",x.title,x.date,"travel"));(data.events||[]).forEach(x=>add("Event",x.title,x.date,"calendar"));add("Notes",data.notes||"","Personal notebook","notes");out.innerHTML=found.length?found.slice(0,40).map(x=>`<button class="search-result" type="button" data-search-go="${x.view}"><strong>${escapeHTML(x.name)}</strong><small>${escapeHTML(x.type)}${x.detail?" · "+escapeHTML(x.detail):""}</small></button>`).join(""):'<p class="empty-hint">No matching items found.</p>';}
function exportPlannerData(){const blob=new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString(),app:"My Life Planner"},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`my-life-planner-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);document.getElementById("backup-status").textContent="Backup downloaded. Keep it somewhere safe.";}


// New section event handlers
const yearNow=new Date().getFullYear();document.getElementById("yearly-year").value=yearNow;document.getElementById("finance-date").value=today();
["yearly-theme","year-goal-1","year-goal-2","year-goal-3"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{const y=document.getElementById("yearly-year").value;data.yearlyPlans=data.yearlyPlans||{};const x=data.yearlyPlans[y]||{theme:"",goals:["","",""]};if(id==="yearly-theme")x.theme=document.getElementById(id).value;else x.goals[Number(id.slice(-1))-1]=document.getElementById(id).value;data.yearlyPlans[y]=x;saveData();}));
document.getElementById("yearly-year").addEventListener("change",renderAdvancedSections);
document.getElementById("milestone-form").addEventListener("submit",e=>{e.preventDefault();data.milestones=data.milestones||[];data.milestones.push({id:uid(),name:document.getElementById("milestone-name").value.trim(),date:document.getElementById("milestone-date").value});saveData();e.target.reset();renderAdvancedSections();});
document.getElementById("routine-form").addEventListener("submit",e=>{e.preventDefault();data.routines=data.routines||[];data.routines.push({id:uid(),name:document.getElementById("routine-name").value.trim(),time:document.getElementById("routine-time").value,frequency:document.getElementById("routine-frequency").value,steps:[],doneDate:today()});saveData();e.target.reset();renderAdvancedSections();});
document.getElementById("finance-budget").addEventListener("change",e=>{data.financeBudget=Number(e.target.value)||0;saveData();renderAdvancedSections();});
document.getElementById("finance-form").addEventListener("submit",e=>{e.preventDefault();data.finance=data.finance||[];data.finance.push({id:uid(),description:document.getElementById("finance-description").value.trim(),amount:Number(document.getElementById("finance-amount").value),type:document.getElementById("finance-type").value,category:document.getElementById("finance-category").value.trim(),date:document.getElementById("finance-date").value});saveData();e.target.reset();document.getElementById("finance-date").value=today();renderAdvancedSections();});
document.getElementById("trip-form").addEventListener("submit",e=>{e.preventDefault();data.trips=data.trips||[];data.trips.push({id:uid(),name:document.getElementById("trip-name").value.trim(),destination:document.getElementById("trip-destination").value.trim(),start:document.getElementById("trip-start").value,end:document.getElementById("trip-end").value,notes:document.getElementById("trip-notes").value.trim(),packing:[]});saveData();e.target.reset();renderAdvancedSections();});
document.getElementById("export-data").addEventListener("click",exportPlannerData);
document.getElementById("import-data").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!imported||typeof imported!=="object"||!Array.isArray(imported.tasks))throw new Error("This doesn't look like a My Life Planner backup.");if(!confirm("Restore this backup? It will replace the planner information currently saved in this browser.")){e.target.value="";return;}data={...defaultData(),...imported};delete data.exportedAt;delete data.app;await saveData();renderAll();renderAdvancedSections();renderLifeSections();document.getElementById("backup-status").textContent="Backup restored successfully.";}catch(err){alert(err.message||"Unable to read this backup file.");}e.target.value="";});
document.getElementById("global-search").addEventListener("input",e=>{const page=document.getElementById("search-page-input");if(page){page.value=e.target.value;runSearch(e.target.value);if(e.target.value)showView("backup");}});
document.getElementById("search-page-input").addEventListener("input",e=>{document.getElementById("global-search").value=e.target.value;runSearch(e.target.value);});
document.getElementById("quick-add-global").addEventListener("click",()=>{const title=prompt("What would you like to add as a task?");if(title&&title.trim()){data.tasks.push({id:uid(),title:title.trim(),date:today(),done:false});saveData();renderTasks();toast("Task added to today");}});
document.getElementById("dashboard-settings").addEventListener("click",e=>{const move=e.target.closest("[data-dashboard-move]");if(!move)return;const cards=[...document.querySelectorAll("#dashboard-view [data-dashboard-card]")],order=cards.map(x=>x.dataset.dashboardCard);const i=order.indexOf(move.dataset.dashboardMove),j=move.dataset.direction==="up"?i-1:i+1;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];data.dashboardOrder=order;saveData();applyDashboardOrder();});
document.getElementById("dashboard-settings").addEventListener("change",e=>{if(!e.target.matches("[data-dashboard-toggle]"))return;const k=e.target.dataset.dashboardToggle;data.dashboardHidden=data.dashboardHidden||[];data.dashboardHidden=e.target.checked?data.dashboardHidden.filter(x=>x!==k):[...new Set([...data.dashboardHidden,k])];saveData();renderDashboardSettings();});
document.getElementById("auto-carry-tasks").addEventListener("change",e=>{data.autoCarryTasks=e.target.checked;if(data.autoCarryTasks)data.tasks.forEach(t=>{if(!t.done&&t.date&&t.date<today())t.date=today();});saveData();renderTasks();renderCalendar();renderWeeklyReview();toast(data.autoCarryTasks?"Automatic task carry-over enabled":"Automatic task carry-over disabled");});
document.addEventListener("click",e=>{const go=e.target.closest("[data-search-go]");if(go){showView(go.dataset.searchGo);return;}const mo=e.target.closest("[data-open-month]");if(mo){monthlySelected=mo.dataset.openMonth;showView("monthly");renderMonthlyPlanner();return;}const dm=e.target.closest("[data-delete-milestone]");if(dm){data.milestones=data.milestones.filter(x=>x.id!==dm.dataset.deleteMilestone);saveData();renderAdvancedSections();return;}const dr=e.target.closest("[data-delete-routine]");if(dr){data.routines=data.routines.filter(x=>x.id!==dr.dataset.deleteRoutine);saveData();renderAdvancedSections();return;}const df=e.target.closest("[data-delete-finance]");if(df){data.finance=data.finance.filter(x=>x.id!==df.dataset.deleteFinance);saveData();renderAdvancedSections();return;}const dt=e.target.closest("[data-delete-trip]");if(dt){data.trips=data.trips.filter(x=>x.id!==dt.dataset.deleteTrip);saveData();renderAdvancedSections();return;}const ds=e.target.closest("[data-routine-delete-step]");if(ds){const r=data.routines.find(x=>x.id===ds.dataset.routineDeleteStep);r?.steps.splice(Number(ds.dataset.index),1);saveData();renderAdvancedSections();return;}const tp=e.target.closest("[data-trip-pack-delete]");if(tp){const t=data.trips.find(x=>x.id===tp.dataset.tripPackDelete);t?.packing.splice(Number(tp.dataset.index),1);saveData();renderAdvancedSections();}});
document.addEventListener("change",e=>{if(e.target.matches("[data-project-task-check]")){const task=data.tasks.find(t=>t.id===e.target.dataset.projectTaskCheck);if(task){task.done=e.target.checked;saveData();renderTasks();renderLifeSections();renderWeeklyReview();}}if(e.target.matches("[data-routine-check]")){const r=data.routines.find(x=>x.id===e.target.dataset.routineCheck);if(r){if(r.doneDate!==today()){r.steps.forEach(s=>s.done=false);r.doneDate=today();}r.steps[Number(e.target.dataset.index)].done=e.target.checked;saveData();renderAdvancedSections();} }if(e.target.matches("[data-trip-pack-check]")){const t=data.trips.find(x=>x.id===e.target.dataset.tripPackCheck);if(t){t.packing[Number(e.target.dataset.index)].done=e.target.checked;saveData();renderAdvancedSections();}}});
document.addEventListener("submit",e=>{const wf=e.target.closest("[data-week-schedule]");if(wf){e.preventDefault();const key=wf.dataset.weekSchedule,plan=getDailyPlan(key);plan.schedule.push({id:uid(),time:wf.elements.time.value,activity:wf.elements.activity.value.trim()});saveData();renderWeeklyReview();return;}const pf=e.target.closest("[data-project-task-form]");if(pf){e.preventDefault();const title=pf.elements.title.value.trim();if(title){data.tasks.push({id:uid(),title,date:pf.elements.date.value,done:false,projectId:pf.dataset.projectTaskForm});saveData();renderTasks();renderLifeSections();renderWeeklyReview();}return;}const rf=e.target.closest("[data-routine-step-form]");if(rf){e.preventDefault();const r=data.routines.find(x=>x.id===rf.dataset.routineStepForm);if(r){r.steps.push({name:rf.elements.step.value.trim(),done:false});saveData();renderAdvancedSections();}return;}const tf=e.target.closest("[data-trip-pack-form]");if(tf){e.preventDefault();const t=data.trips.find(x=>x.id===tf.dataset.tripPackForm);if(t){t.packing.push({name:tf.elements.item.value.trim(),done:false});saveData();renderAdvancedSections();}}});

document.getElementById("home-record-form").addEventListener("submit",e=>{e.preventDefault();data.homeRecords.push({id:uid(),type:document.getElementById("home-record-type").value,name:document.getElementById("home-record-name").value.trim(),date:document.getElementById("home-record-date").value,details:document.getElementById("home-record-details").value.trim()});saveData();e.target.reset();renderLifeSections();});
document.getElementById("saving-form").addEventListener("submit",e=>{e.preventDefault();data.savingsGoals.push({id:uid(),name:document.getElementById("saving-name").value.trim(),target:Number(document.getElementById("saving-target").value)});saveData();e.target.reset();renderAdvancedSections();});
document.getElementById("subscription-form").addEventListener("submit",e=>{e.preventDefault();data.subscriptions.push({id:uid(),name:document.getElementById("subscription-name").value.trim(),amount:Number(document.getElementById("subscription-amount").value),frequency:document.getElementById("subscription-frequency").value});saveData();e.target.reset();renderAdvancedSections();});
document.getElementById("itinerary-form").addEventListener("submit",e=>{e.preventDefault();if(!document.getElementById("itinerary-trip").value){toast("Create a trip first");return;}data.itinerary.push({id:uid(),tripId:document.getElementById("itinerary-trip").value,date:document.getElementById("itinerary-date").value,time:document.getElementById("itinerary-time").value,title:document.getElementById("itinerary-title").value.trim()});saveData();document.getElementById("itinerary-title").value="";renderAdvancedSections();});
document.getElementById("planner-theme").addEventListener("change",e=>{data.plannerTheme=e.target.value;document.body.dataset.theme=e.target.value;saveData();});
document.getElementById("print-current").addEventListener("click",()=>window.print());
document.addEventListener("click",e=>{const sv=e.target.closest("[data-delete-saving]");if(sv){data.savingsGoals=data.savingsGoals.filter(x=>x.id!==sv.dataset.deleteSaving);saveData();renderAdvancedSections();return;}const sb=e.target.closest("[data-delete-subscription]");if(sb){data.subscriptions=data.subscriptions.filter(x=>x.id!==sb.dataset.deleteSubscription);saveData();renderAdvancedSections();return;}const it=e.target.closest("[data-delete-itinerary]");if(it){data.itinerary=data.itinerary.filter(x=>x.id!==it.dataset.deleteItinerary);saveData();renderAdvancedSections();}});

// Focus timer is intentionally session-only; it does not need to save personal data.
let focusRemaining=25*60,focusInterval=null;const focusClock=document.getElementById("focus-clock");function paintFocus(){focusClock.textContent=`${String(Math.floor(focusRemaining/60)).padStart(2,"0")}:${String(focusRemaining%60).padStart(2,"0")}`;}
document.getElementById("focus-duration").addEventListener("change",e=>{focusRemaining=Math.max(1,Math.min(180,Number(e.target.value)||25))*60;clearInterval(focusInterval);focusInterval=null;paintFocus();document.getElementById("focus-status").textContent="Timer ready.";});
document.getElementById("focus-start").addEventListener("click",()=>{if(focusInterval)return;document.getElementById("focus-status").textContent="Focus session in progress. You can pause any time.";focusInterval=setInterval(()=>{focusRemaining=Math.max(0,focusRemaining-1);paintFocus();if(!focusRemaining){clearInterval(focusInterval);focusInterval=null;document.getElementById("focus-status").textContent="Session complete. Take a short break.";toast("Focus session complete");}},1000);});
document.getElementById("focus-pause").addEventListener("click",()=>{clearInterval(focusInterval);focusInterval=null;document.getElementById("focus-status").textContent="Paused. Resume when you're ready.";});
document.getElementById("focus-reset").addEventListener("click",()=>{clearInterval(focusInterval);focusInterval=null;focusRemaining=(Number(document.getElementById("focus-duration").value)||25)*60;paintFocus();document.getElementById("focus-status").textContent="Timer reset.";});

function showView(name) {
  const target = document.getElementById(`${name}-view`);
  if (!target) { console.warn(`Planner view not found: ${name}`); return; }
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  target.classList.add("active-view");
  if (name === "daily") renderDailyPlanner();
  if (name === "weekly") renderWeeklyReview();
  if (name === "dashboard") renderDashboardSettings();
  if (name === "monthly") renderMonthlyPlanner();
  if (["home","projects","collections","wellness"].includes(name)) renderLifeSections();
  if (["yearly","routines","finance","travel","backup"].includes(name)) renderAdvancedSections();
  document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.getElementById("section-name").textContent = name.toUpperCase();
  document.getElementById("sidebar").classList.remove("open");
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showView(b.dataset.go)));
document.getElementById("menu-toggle").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
window.addEventListener("online", () => { document.getElementById("connection-label").textContent = "Ready to plan"; });
window.addEventListener("offline", () => { document.getElementById("connection-label").textContent = "Offline mode"; });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {
    document.getElementById("connection-label").textContent = "Offline setup pending";
  }));
}
loadData();
