MY LIFE PLANNER — INTEGRATED UPGRADE
====================================

This update builds on your existing My Life Planner. It keeps the existing IndexedDB database name/store and adds new fields to the existing saved data rather than replacing the database.

WHAT'S NEW
----------
1. Integrated dashboard
   - Today's meals, movement and Daily Planner priorities appear on the dashboard.
   - Dashboard cards can be hidden/shown and moved up/down in Backup & Settings.
   - Global search now includes goals, habits, meals and saved recipes.
   - Optional automatic overdue-task carry-over can be switched on in Backup & Settings.

2. Full Monday–Sunday weekly planner
   - Seven-day spread with daily focus fields.
   - View and add time-specific schedule items directly in each day.
   - Tasks, events, habits, meals and workouts are shown together.
   - Tick tasks and habits from the weekly spread.
   - Open any day in the Daily Planner.

3. Advanced habits and routines
   - Habit frequencies: daily, weekdays, weekends, twice weekly, three times weekly or once weekly.
   - Weekly habit targets and simple streak counts.
   - Routine frequencies: daily, weekdays, weekends or weekly.
   - Existing habit completion data is migrated into date-based check-ins where possible.

4. Connected meal planning
   - Save reusable recipes with ingredients and instructions.
   - Add a saved recipe to a selected date in the meal plan.
   - Recipe ingredients are added to the grocery list automatically.
   - Ingredients entered in the meal planner continue to be added to groceries.
   - Meals appear on the weekly spread, Daily Planner and dashboard.

5. Visual wellness and goal tracking
   - 30-day mood trend chart with unrecorded days shown as gaps.
   - 30-day average sleep and water summaries.
   - Goals now support life categories, target dates, reasons, next steps and progress.

IMPORTANT LIMITATION — CLOUD SYNC
---------------------------------
Cloud synchronisation and personal accounts are NOT enabled in this update. The planner still stores data in the browser on the device where it is used. A secure sync service requires a backend provider, account/authentication setup, database rules and user-specific configuration. Do not enter passwords or private keys into the public GitHub repository.

BEFORE UPDATING
---------------
1. Open your current planner.
2. Go to Backup & Settings.
3. Click Download backup and save the JSON file somewhere safe.

UPLOAD TO GITHUB
----------------
1. Download this ZIP and extract it.
2. Open your repository:
   https://github.com/TheImperfectPlans/My-Life-Planner
3. Upload and replace these four files in the repository root:
   - index.html
   - app.js
   - style.css
   - service-worker.js
4. Commit the changes.
5. Open the repository's Actions tab and wait for the Pages deployment to show a green tick.
6. Open your planner:
   https://theimperfectplans.github.io/My-Life-Planner/
7. Press Ctrl + Shift + R to force a refresh.

KEEP THESE EXISTING FILES
-------------------------
Do not delete or replace manifest.json or icon.svg. They are not included in this update because they do not need to change.

AFTER DEPLOYMENT
----------------
- Check the new Monday–Sunday weekly spread.
- Add a habit with a weekly frequency and tick it off on different days.
- Save a recipe, then use Add to meal plan. Check that its ingredients appear in groceries.
- Add wellness check-ins on a few dates to populate the 30-day chart.
- Open Backup & Settings to move dashboard cards and optionally enable automatic overdue-task carry-over.
- Download another backup after testing.

VALIDATION
----------
The JavaScript syntax, static HTML element references, duplicate HTML IDs, service-worker cache version and ZIP integrity were checked before packaging. A full interactive browser test could not be completed in this environment, so please test the new interactions after deployment.
