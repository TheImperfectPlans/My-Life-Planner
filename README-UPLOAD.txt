MY LIFE PLANNER — DAILY DASHBOARD REDESIGN

This update redesigns the dashboard as a day-by-day home for the information you want to see and update in one place.

WHAT'S NEW ON THE DASHBOARD
- Appointments and calendar events for the selected date, alongside a quick-add daily schedule.
- Today's top three priorities and task list, with quick task entry and completion checkboxes.
- Date-aware routine step checkboxes and the existing daily habit tracker.
- Meals planned for the selected date.
- A grocery list preview with the ability to add and tick off items.
- Weekly priorities and monthly focus/priorities pulled from the existing weekly and monthly planners.
- Active goals pulled from the existing goals section.
- A daily mood check-in.
- A gratitude note and an evening reflection saved separately for each date.
- Dashboard cards can still be hidden and reordered in Backup & settings.

DATA AND COMPATIBILITY
- Existing IndexedDB database name, object store, and saved planner data are preserved.
- Existing tasks, calendar events, meals, groceries, routines, habits, goals, weekly plans and monthly plans are reused.
- Daily gratitude uses the existing daily reflection field. Evening reflection adds a field within the existing daily plan record.
- Routine check-offs are stored by date in the existing daily plan record.
- The service-worker cache is updated to v14 so the browser can load the new dashboard files.
- Keep your existing manifest.json and icon.svg files; they are not included in this update.
- Planner information remains stored locally in the browser on this device. This update does not add cloud sync.

HOW TO INSTALL
1. Download and extract this ZIP file.
2. Open your GitHub repository: https://github.com/TheImperfectPlans/My-Life-Planner
3. Upload and replace these four files in the repository root:
   - index.html
   - app.js
   - style.css
   - service-worker.js
4. Do not delete or replace manifest.json or icon.svg.
5. Commit the changes to the main branch.
6. Open the Actions tab and wait until the latest Pages deployment has a green tick.
7. Open https://theimperfectplans.github.io/My-Life-Planner/ and press Ctrl + Shift + R to force a refresh.

IMPORTANT
Keep using the same browser and device if you want to see the same locally saved planner data. Before making major changes or changing devices, download a backup from Backup & settings.
