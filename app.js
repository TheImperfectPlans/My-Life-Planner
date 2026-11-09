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
  weeklyReviews: {}
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
  data.weeklyReviews = data.weeklyReviews || {};
  data.events = data.events || [];
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
}
function taskHTML(task) {
  return `<div class="task-row ${task.done ? "done" : ""}">
    <input type="checkbox" data-task-check="${task.id}" ${task.done ? "checked" : ""} aria-label="Mark ${escapeHTML(task.title)} complete">
    <label>${escapeHTML(task.title)}</label>
    ${task.date ? `<span class="task-date">${niceDate(task.date)}</span>` : ""}
    <button class="delete-button" data-task-delete="${task.id}" aria-label="Delete task">×</button>
  </div>`;
}
function renderHabits() {
  const todays = data.habits.filter(h => h.date === today());
  const completed = todays.filter(h => h.done).length;
  document.getElementById("habit-count").textContent = `${completed} / ${todays.length}`;
  document.getElementById("habit-progress").textContent = `${completed} of ${todays.length} completed`;
  const html = todays.map(h => `<div class="habit-row"><button class="habit-check ${h.done ? "checked" : ""}" data-habit="${h.id}" aria-label="Toggle ${escapeHTML(h.name)}">${h.done ? "✓" : ""}</button><label>${escapeHTML(h.name)}</label><small>${h.done ? "Done" : "Today"}</small></div>`).join("");
  document.getElementById("dashboard-habits").innerHTML = html || '<p class="empty-hint">Add a habit to begin.</p>';
  document.getElementById("all-habits").innerHTML = html || '<p class="empty-hint">No habits yet.</p>';
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
  if (habit) { const item = data.habits.find(h => h.id === habit.dataset.habit); if (item) item.done = !item.done; saveData(); renderHabits(); }
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
      saveData(); renderCalendar(); renderDailyPlanner(); renderWeeklyReview(); toast("Event deleted");
    }
  }
});
document.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => { currentFilter = b.dataset.filter; renderTasks(); }));
document.getElementById("habit-form").addEventListener("submit", e => {
  e.preventDefault(); const input = document.getElementById("habit-input");
  if (input.value.trim()) { data.habits.push({ id: uid(), name: input.value.trim(), done: false, date: today() }); input.value = ""; saveData(); renderHabits(); toast("Habit added"); }
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
function eventOccursOnDate(item, key) {
  const start = item.date || item.startDate;
  const end = item.endDate || start;
  return !!start && key >= start && key <= end;
}
function eventsForDate(key) {
  return (data.events || []).filter(item => eventOccursOnDate(item, key)).map(item => ({...item, kind: "event"}));
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
  data.events.push({id:uid(), title:title.value.trim(), date:date.value, endDate, time:document.getElementById("event-time").value, type:document.getElementById("event-type").value});
  selectedCalendarDate = date.value; calendarDate = new Date(date.value + "T12:00:00");
  // Take the Daily Planner to the event's start date so the newly added event is immediately visible there.
  dailySelectedDate = date.value;
  saveData(); renderCalendar(); renderDailyPlanner(); renderWeeklyReview(); title.value = ""; date.value = today(); endDateInput.value = ""; document.getElementById("event-time").value = "";
  toast(isMultiDay ? "Multi-day event saved" : "Event saved to your calendar");
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
  const events=eventsForDate(dailySelectedDate);
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
  data.habits.forEach(h=>{const key=(h.name||"").trim().toLowerCase(); if(key && !seen.has(key)){seen.add(key);unique.push(h);}});
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
  if(e.target.matches("[data-daily-task]")){const task=data.tasks.find(t=>t.id===e.target.dataset.dailyTask);if(task){task.done=e.target.checked;saveData();renderTasks();renderDailyTasks();renderCalendar();renderWeeklyReview();}}
  if(e.target.matches("[data-daily-habit]")){const id=e.target.dataset.dailyHabit;const checks=new Set(getDailyPlan().habitChecks);if(e.target.checked)checks.add(id);else checks.delete(id);getDailyPlan().habitChecks=[...checks];saveDailyPlan();}
});

// Weekly Review: saved separately for each Sunday-to-Saturday week.
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
  const habitNames=[...new Map(data.habits.map(h=>[(h.name||"").trim().toLowerCase(),h.name])).values()].filter(Boolean);
  let habitDone=0;
  for(let i=0;i<7;i++){const key=dateKey(addDays(start,i));const checks=(data.dailyPlans?.[key]?.habitChecks)||[];habitDone+=checks.length;}
  document.getElementById("weekly-habits").textContent=`${habitDone} / ${habitNames.length*7}`;
  const events=[]; for(let i=0;i<7;i++){const key=dateKey(addDays(start,i));eventsForDate(key).forEach(ev=>events.push({...ev,day:key}));}
  const eventEl=document.getElementById("weekly-events-list");
  eventEl.innerHTML=events.length?events.map(ev=>`<div class="weekly-event-row"><span class="legend-dot ${escapeHTML(ev.type)}"></span><span><strong>${escapeHTML(ev.title)}</strong><small>${dateLabel(ev.day,{weekday:"short",day:"numeric",month:"short"})}${ev.time?" · "+escapeHTML(ev.time):""}</small></span></div>`).join(""):'<p class="daily-empty">No calendar events scheduled for this week.</p>';
  const review=getWeeklyReview();
  [["weekly-wins",review.wins],["weekly-challenges",review.challenges],["weekly-improve",review.improve]].forEach(([id,value])=>document.getElementById(id).value=value||"");
  [1,2,3].forEach((n,i)=>document.getElementById(`weekly-priority-${n}`).value=review.priorities[i]||"");
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

function showView(name) {
  const target = document.getElementById(`${name}-view`);
  if (!target) { console.warn(`Planner view not found: ${name}`); return; }
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  target.classList.add("active-view");
  if (name === "daily") renderDailyPlanner();
  if (name === "weekly") renderWeeklyReview();
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
