const DB_NAME = "my-life-planner";
const STORE = "planner";
const STORAGE_KEY = "planner-data-v1";
function today() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

const defaultData = () => ({
  tasks: [],
  events: [],
  habits: [
    { id: "h1", name: "Drink a glass of water", done: false, date: today() },
    { id: "h2", name: "Move my body", done: false, date: today() },
    { id: "h3", name: "Read for 10 minutes", done: false, date: today() }
  ],
  goals: [],
  mood: {},
  intention: "",
  notes: ""
});

let data = defaultData();
let currentFilter = "all";
let db = null;

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
loadData();

/* =================================
   MY LIFE PLANNER - CALENDAR LOGIC
================================= */

// Calendar settings

let calendarDate = new Date();
let selectedCalendarDate = today();
let calendarView = "month";


// Convert date strings into local dates

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}


// Format a date as YYYY-MM-DD

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// Display date in a readable format

function formatCalendarDate(dateString) {
  return parseLocalDate(dateString).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}


// Get all events and tasks for a date

function getCalendarItems(dateString) {

  const events = (data.events || [])
    .filter(event => event.date === dateString)
    .map(event => ({
      ...event,
      itemType: event.type,
      label: event.title
    }));

  const tasks = (data.tasks || [])
    .filter(task => task.date === dateString)
    .map(task => ({
      ...task,
      itemType: "task",
      label: task.title
    }));

  return [...events, ...tasks].sort((a, b) => {
    return (a.time || "").localeCompare(b.time || "");
  });
}


// Create the calendar grid

function renderCalendar() {

  const grid = document.getElementById("calendar-grid");

  if (!grid) return;

  grid.innerHTML = "";

  const heading = document.getElementById("calendar-heading");

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  let dates = [];


  // MONTH VIEW

  if (calendarView === "month") {

    heading.textContent = calendarDate.toLocaleDateString("en-AU", {
      month: "long",
      year: "numeric"
    });

    weekdays.forEach(day => {
      const label = document.createElement("div");
      label.className = "calendar-weekday";
      label.textContent = day;
      grid.appendChild(label);
    });

    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < offset; i++) {
      dates.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(year, month, day));
    }

    grid.className = "calendar-grid month-view";
  }


  // WEEK VIEW

  if (calendarView === "week") {

    const current = new Date(calendarDate);

    const mondayOffset = (current.getDay() + 6) % 7;

    const monday = new Date(current);
    monday.setDate(current.getDate() - mondayOffset);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    heading.textContent =
      monday.toLocaleDateString("en-AU", { day: "numeric", month: "short" }) +
      " – " +
      sunday.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

    weekdays.forEach(day => {
      const label = document.createElement("div");
      label.className = "calendar-weekday";
      label.textContent = day;
      grid.appendChild(label);
    });

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }

    grid.className = "calendar-grid week-view";
  }


  // DAY VIEW

  if (calendarView === "day") {

    heading.textContent = calendarDate.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    dates.push(new Date(calendarDate));

    grid.className = "calendar-grid day-view";
  }


  // CREATE EACH DATE CELL

  dates.forEach(date => {

    if (!date) {

      const empty = document.createElement("div");
      grid.appendChild(empty);

      return;
    }

    const dateKey = formatDateKey(date);

    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "calendar-cell";

    if (dateKey === today()) {
      cell.classList.add("today");
    }

    if (dateKey === selectedCalendarDate) {
      cell.classList.add("selected");
    }

    if (date.getMonth() !== month && calendarView === "month") {
      cell.classList.add("outside-month");
    }

    const dateLabel = document.createElement("span");

    dateLabel.className = "calendar-cell-date";
    dateLabel.textContent = date.getDate();

    cell.appendChild(dateLabel);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "calendar-cell-items";

    const items = getCalendarItems(dateKey);

    items.slice(0, calendarView === "month" ? 3 : 8).forEach(item => {

      const chip = document.createElement("span");

      chip.className = `calendar-item-chip ${item.itemType}`;

      const time = item.time ? item.time + " " : "";

      chip.textContent = time + item.label;

      itemsContainer.appendChild(chip);

    });

    if (items.length > (calendarView === "month" ? 3 : 8)) {

      const more = document.createElement("span");

      more.className = "calendar-more";
      more.textContent = `+${items.length - (calendarView === "month" ? 3 : 8)} more`;

      itemsContainer.appendChild(more);

    }

    cell.appendChild(itemsContainer);

    cell.addEventListener("click", () => {

      selectedCalendarDate = dateKey;
      calendarDate = new Date(date);

      renderCalendar();
      renderSelectedDay();

    });

    grid.appendChild(cell);

  });


  // Update selected date details

  renderSelectedDay();

}


// DISPLAY EVENTS AND TASKS FOR SELECTED DATE

function renderSelectedDay() {

  const heading = document.getElementById("selected-day-heading");
  const container = document.getElementById("selected-day-events");

  if (!heading || !container) return;

  heading.textContent = formatCalendarDate(selectedCalendarDate);

  const items = getCalendarItems(selectedCalendarDate);

  if (!items.length) {

    container.innerHTML = `
      <p class="calendar-empty">
        Nothing planned for this day yet. Enjoy the breathing space.
      </p>
    `;

    return;
  }

  container.innerHTML = `
    <div class="selected-day-list">
      ${items.map(item => {

        const time = item.time ? item.time : "No time set";

        return `
          <div class="selected-day-item">

            <span class="selected-day-marker ${item.itemType}"></span>

            <div class="selected-day-content">
              <strong>${escapeHTML(item.label)}</strong>
              <small>
                ${escapeHTML(item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1))}
                · ${escapeHTML(time)}
                ${item.done ? " · Completed" : ""}
              </small>
            </div>

            ${
              item.itemType !== "task"
              ? `<button
                  type="button"
                  class="calendar-delete"
                  data-event-delete="${escapeHTML(item.id)}"
                  aria-label="Delete event"
                >×</button>`
              : ""
            }

          </div>
        `;

      }).join("")}
    </div>
  `;

}


// ADD A NEW EVENT

document.getElementById("event-form").addEventListener("submit", event => {

  event.preventDefault();

  const title = document.getElementById("event-title").value.trim();
  const date = document.getElementById("event-date").value;
  const time = document.getElementById("event-time").value;
  const type = document.getElementById("event-type").value;

  if (!title || !date) {
    toast("Please enter an event name and date.");
    return;
  }

  data.events = data.events || [];

  data.events.push({
    id: uid(),
    title,
    date,
    time,
    type
  });

  selectedCalendarDate = date;
  calendarDate = parseLocalDate(date);

  saveData();

  renderCalendar();

  document.getElementById("event-title").value = "";
  document.getElementById("event-time").value = "";
  document.getElementById("event-date").value = date;

  toast("Event saved");

});


// DELETE AN EVENT

document.addEventListener("click", event => {

  const deleteButton = event.target.closest("[data-event-delete]");

  if (!deleteButton) return;

  const eventId = deleteButton.dataset.eventDelete;

  data.events = (data.events || []).filter(item => item.id !== eventId);

  saveData();

  renderCalendar();

  toast("Event deleted");

});


// SWITCH BETWEEN MONTH, WEEK AND DAY

document.querySelectorAll("[data-calendar-view]").forEach(button => {

  button.addEventListener("click", () => {

    calendarView = button.dataset.calendarView;

    document.querySelectorAll("[data-calendar-view]").forEach(viewButton => {
      viewButton.classList.toggle(
        "active",
        viewButton.dataset.calendarView === calendarView
      );
    });

    renderCalendar();

  });

});


// PREVIOUS MONTH, WEEK OR DAY

document.getElementById("prev-period").addEventListener("click", () => {

  if (calendarView === "month") {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
  }

  if (calendarView === "week") {
    calendarDate.setDate(calendarDate.getDate() - 7);
  }

  if (calendarView === "day") {
    calendarDate.setDate(calendarDate.getDate() - 1);
  }

  selectedCalendarDate = formatDateKey(calendarDate);

  renderCalendar();

});


// NEXT MONTH, WEEK OR DAY

document.getElementById("next-period").addEventListener("click", () => {

  if (calendarView === "month") {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
  }

  if (calendarView === "week") {
    calendarDate.setDate(calendarDate.getDate() + 7);
  }

  if (calendarView === "day") {
    calendarDate.setDate(calendarDate.getDate() + 1);
  }

  selectedCalendarDate = formatDateKey(calendarDate);

  renderCalendar();

});


// JUMP BACK TO TODAY

document.getElementById("calendar-today").addEventListener("click", () => {

  calendarDate = new Date();
  selectedCalendarDate = today();

  renderCalendar();

});


// SET DEFAULT EVENT DATE

document.getElementById("event-date").value = today();


// FIRST CALENDAR DISPLAY

renderCalendar();
