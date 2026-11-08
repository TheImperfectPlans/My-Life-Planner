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
  notes: ""
  dailyPlans: {},
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
      if (task) { task.done = !task.done; saveData(); renderTasks(); renderSelectedDay(); }
    } else if (kind === "event") {
      data.events = data.events.filter(item => item.id !== id);
      saveData(); renderCalendar(); renderSelectedDay(); toast("Event deleted");
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
  saveData(); renderCalendar(); title.value = ""; document.getElementById("event-time").value = "";
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
// ==================================
// DAILY PLANNER
// ==================================

let dailySelectedDate = today();

function getDailyPlan(date) {
  if (!data.dailyPlans) {
    data.dailyPlans = {};
  }

  if (!data.dailyPlans[date]) {
    data.dailyPlans[date] = {
      priorities: ["", "", ""],
      schedule: [],
      reflection: {
        well: "",
        challenge: "",
        grateful: ""
      },
      habits: []
    };
    if (name === "daily") {
  renderDailyPlanner();
}
  }

  return data.dailyPlans[date];
}


// SAVE DAILY PLAN

function saveDailyPlan() {
  saveData();

  const status = document.getElementById("daily-save-status");

  if (status) {
    status.textContent = "✓ Saved automatically";
  }
}


// RENDER DAILY PLANNER

function renderDailyPlanner() {

  const dateInput = document.getElementById("daily-date");

  if (!dateInput) return;

  dateInput.value = dailySelectedDate;

  const plan = getDailyPlan(dailySelectedDate);


  // PRIORITIES

  [1, 2, 3].forEach(number => {

    const input = document.getElementById("priority-" + number);

    input.value = plan.priorities[number - 1] || "";

    input.oninput = () => {

      plan.priorities[number - 1] = input.value;

      saveDailyPlan();

    };

  });


  // REFLECTION

  const reflectionFields = [
    ["reflection-well", "well"],
    ["reflection-challenge", "challenge"],
    ["reflection-grateful", "grateful"]
  ];

  reflectionFields.forEach(([id, key]) => {

    const field = document.getElementById(id);

    field.value = plan.reflection[key] || "";

    field.oninput = () => {

      plan.reflection[key] = field.value;

      saveDailyPlan();

    };

  });


  renderDailySchedule();

  renderDailyTasks();

  renderDailyHabits();

}


// SCHEDULE

function renderDailySchedule() {

  const container =
    document.getElementById("daily-schedule-list");

  const plan = getDailyPlan(dailySelectedDate);

  plan.schedule.sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  if (!plan.schedule.length) {

    container.innerHTML =
      '<p class="daily-empty">Nothing scheduled yet.</p>';

    return;
  }

  container.innerHTML = plan.schedule.map(item => `

    <div class="daily-schedule-item">

      <strong>${escapeHTML(item.time)}</strong>

      <span>${escapeHTML(item.activity)}</span>

      <button
        type="button"
        data-daily-schedule-delete="${item.id}">
        ✕
      </button>

    </div>

  `).join("");

}


// ADD SCHEDULE ITEM

document.getElementById("schedule-form")
  .addEventListener("submit", event => {

    event.preventDefault();

    const time =
      document.getElementById("schedule-time").value;

    const activity =
      document.getElementById("schedule-activity").value.trim();

    if (!time || !activity) return;

    const plan = getDailyPlan(dailySelectedDate);

    plan.schedule.push({
      id: uid(),
      time,
      activity
    });

    document.getElementById("schedule-activity").value = "";

    renderDailySchedule();

    saveDailyPlan();

  });


// DELETE SCHEDULE ITEM

document.addEventListener("click", event => {

  const button =
    event.target.closest("[data-daily-schedule-delete]");

  if (!button) return;

  const plan = getDailyPlan(dailySelectedDate);

  plan.schedule = plan.schedule.filter(item =>
    item.id !== button.dataset.dailyScheduleDelete
  );

  renderDailySchedule();

  saveDailyPlan();

});


// TODAY'S TASKS

function renderDailyTasks() {

  const container =
    document.getElementById("daily-tasks-list");

  const tasks = data.tasks.filter(task =>
    task.date === dailySelectedDate
  );

  if (!tasks.length) {

    container.innerHTML =
      '<p class="daily-empty">No tasks due on this date.</p>';

    return;
  }

  container.innerHTML = tasks.map(task => `

    <div class="daily-task-item">

      <input
        type="checkbox"
        ${task.done ? "checked" : ""}
        data-daily-task="${task.id}">

      <span>${escapeHTML(task.title)}</span>

    </div>

  `).join("");

}


// COMPLETE DAILY TASK

document.addEventListener("change", event => {

  const checkbox =
    event.target.closest("[data-daily-task]");

  if (!checkbox) return;

  const task = data.tasks.find(item =>
    item.id === checkbox.dataset.dailyTask
  );

  if (task) {

    task.done = checkbox.checked;

    saveData();

    renderTasks();

    renderDailyTasks();

  }

});


// DAILY HABITS

function renderDailyHabits() {

  const container =
    document.getElementById("daily-habits-list");

  const plan = getDailyPlan(dailySelectedDate);

  if (!data.habits.length) {

    container.innerHTML =
      '<p class="daily-empty">Add habits in your Habits section first.</p>';

    return;
  }

  container.innerHTML = data.habits.map(habit => {

    const completed = plan.habits.includes(habit.id);

    return `

      <label class="daily-habit-item">

        <input
          type="checkbox"
          data-daily-habit="${habit.id}"
          ${completed ? "checked" : ""}>

        <span>${escapeHTML(habit.name)}</span>

      </label>

    `;

  }).join("");

}


// SAVE HABIT CHECK-IN

document.addEventListener("change", event => {

  const checkbox =
    event.target.closest("[data-daily-habit]");

  if (!checkbox) return;

  const plan = getDailyPlan(dailySelectedDate);

  const id = checkbox.dataset.dailyHabit;

  if (checkbox.checked) {

    if (!plan.habits.includes(id)) {
      plan.habits.push(id);
    }

  } else {

    plan.habits = plan.habits.filter(item =>
      item !== id
    );

  }

  saveDailyPlan();

});


// CHANGE DATE

document.getElementById("daily-date")
  .addEventListener("change", event => {

    dailySelectedDate = event.target.value || today();

    renderDailyPlanner();

  });


// BACK TO TODAY

document.getElementById("daily-today")
  .addEventListener("click", () => {

    dailySelectedDate = today();

    renderDailyPlanner();

  });


// INITIALISE

renderDailyPlanner();
loadData();
