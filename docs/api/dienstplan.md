# Dienstplan und Urlaub (TASK-042)

After the pilot (roadmap §6 M5 candidate, D11: hidden in pilot mode). The owner plans who works
in the shop when (shifts, Verkauf only), who is away (all areas: urlaub / frei / abwesend) and
keeps a vacation account per person and year. Task and decisions:
`.mc/tasks/todo/TASK-042-dienstplan-urlaub-mitarbeiterprofile.md` (section "Entscheidungen").

Code in `apps/bakery-api/`: rules and formulas **once** in `src/services/vacation.core.js`
(dependency-free, `tests/unit/vacationCore.test.js`); DB, validation, transaction and audit in
`src/services/dienstplan.service.ts`; routes in `src/routes/dienstplan.routes.ts`
(`createDienstplanRouter(options)`, mounted by `app.ts` below the session guard); integration
tests `tests/integration/dienstplan.test.ts`.

**Access:** `inhaber` from a **personal session** only (`requireRole('inhaber')` +
`requirePersonalSession` on the whole router) - staff data is not opened by a PIN at a station.
Other roles 403 `forbidden`, a PIN session 403 `personal_session_required`, no session 401.

**Personal data stays in the box's SQLite** (D13) - never in hq. No phone, address, IBAN, tax id
or health data (there is no "krank"); this repo, its tests and the setup-dev seed use invented
people only.

| Endpoint                                                         | Answer (`{ success, data }`, writes may add `warnings`)                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/dienstplan?from=&to=`                                  | calendar: `{ from, to, today, closedWeekdays, employees[], shifts[], absences[], days[] }`                                        |
| `GET /api/dienstplan/employees`                                  | all employees (incl. deactivated), Verkauf first, then Backstube, Fahrer, Büro; by name                                           |
| `POST /api/dienstplan/employees`                                 | `{ displayName, area, color?, employmentType?, weeklyHours?, entryDate?, exitDate?, userId?, note? }` → 201                       |
| `GET /api/dienstplan/employees/:id?year=`                        | profile: `{ employee, year, entitlements[], balance, absences[] (of the year), upcomingShifts[] (≤ 20), closedWeekdays }`         |
| `PATCH /api/dienstplan/employees/:id`                            | any of the fields above + `active`; `active: false` deactivates. **No DELETE** (404)                                              |
| `GET /api/dienstplan/employees/:id/entitlements`                 | `[{ employeeId, year, entitlementDays, carryoverDays }]`, newest year first                                                       |
| `PUT /api/dienstplan/employees/:id/entitlements/:year`           | `{ entitlementDays?, carryoverDays? }` (number 0-365 or `null` = offen); upsert of that year's row                                |
| `GET/POST /api/dienstplan/shift-templates`, `PATCH/DELETE …/:id` | `{ id, name, startTime, endTime, breakMinutes }`                                                                                  |
| `GET /api/dienstplan/shifts?from=&to=[&employeeId=]`             | `[{ id, employeeId, date, startTime, endTime, breakMinutes, minutes, note }]`                                                     |
| `POST /api/dienstplan/shifts`, `PATCH/DELETE …/:id`              | `{ employeeId, date, startTime?, endTime?, breakMinutes?, templateId?, note? }` - times from the template unless given            |
| `GET /api/dienstplan/absences?from=&to=[&employeeId=]`           | overlapping the range: `[{ id, employeeId, type, status, startDate, endDate, halfDay, days, note }]`                              |
| `POST /api/dienstplan/absences`, `PATCH/DELETE …/:id`            | `{ employeeId, type, status?, startDate, endDate?, halfDay?, note? }` - `status` default `geplant`, `endDate` default `startDate` |
| `GET /api/dienstplan/balance?year=[&employeeId=]`                | one balance, or a list of all employees employed in that year (`+ displayName, area, active`)                                     |

Ranges (`from`/`to`) are required, `from ≤ to`, at most 366 days (400 `invalid_range`). `year`
defaults to the current year (Berlin), 2000-2100 (400 `invalid_year`).

## Model

Migration `20270107000000-dienstplan.js` (additive, idempotent), models `Employee`,
`VacationEntitlement`, `ShiftTemplate`, `Shift`, `Absence`:

- `employees` - `display_name` (authoritative), `area` `verkauf|backstube|fahrer|buero`, `color`
  `#RRGGBB`, `employment_type` `vollzeit|teilzeit|minijob|aushilfe`, `weekly_hours`,
  `entry_date`/`exit_date` (each optional), `active`, `user_id` → users (optional, `SET NULL`;
  one login links to at most one employee, 409 `user_linked`), `note`. Employees are deactivated,
  never deleted.
- `vacation_entitlements` - one row per employee and `year` (unique): `entitlement_days` (the
  full annual entitlement) and `carryover_days`, both nullable. Per year, so changing next year's
  entitlement never rewrites an old year.
- `shift_templates` - name, times, break. A shift copies the times; changing or deleting a
  template does not touch shifts.
- `shifts` - `employee_id`, `date`, `start_time`, `end_time` (`HH:MM`), `break_minutes`, `note`.
- `absences` - `employee_id`, `type` `urlaub|frei|abwesend`, `status` `geplant|genehmigt`,
  `start_date`, `end_date` (whole days), `half_day` (single day only), `note`.

## Rules (`vacation.core.js`)

- **Holidays Saarland**, computed from Easter (Meeus/Jones/Butcher): Neujahr, Karfreitag,
  Ostermontag, 1. Mai, Christi Himmelfahrt, Pfingstmontag, Fronleichnam, Mariä Himmelfahrt, 3. Oktober, Allerheiligen, 1./2. Weihnachtstag. Holidays are closed.
- **Ruhetag** = `closed_weekdays` from `HQ_FINANCE_DIR/config/targets.json` (same field and
  validation as the Tagesziel, `normalizeClosedWeekdays` in `targets.core.js`), read on every
  request. Without a valid list (file missing, unreadable, field invalid) Monday;
  `closedWeekdays.source` says `config` or `default`. An explicit `[]` is valid (open every day).
- **Day weight:** 0 closed (Ruhetag or holiday), 0.5 on 24.12. and 31.12. when open, else 1.
  Saturday and Sunday are normal opening days - the same 6-day week for everyone, regardless of
  the profile.
- **Vacation days of an absence** = sum of the day weights; `halfDay` counts at most 0.5 per day
  (0.5 also on 24.12., 0 on a closed day). Only `urlaub` uses up the account; `frei` and
  `abwesend` do not.
- **Pro-rata entitlement:** a person employed the whole year gets `entitlementDays`. With entry or
  exit in the year: 1/12 per full employment month, counted from the first day employed in the
  year (15.03. → 15.03.-14.04. is one month). Rounding § 5 Abs. 2 BUrlG: a fraction of at least
  half a day rounds up to a full day; smaller fractions stay (2 decimals), they are never rounded
  down. The owner decided this for entry **and** exit; the statutory minimum for a person who
  leaves in the second half of the year after the waiting period can be higher - the owner then
  enters it as that year's entitlement.
- **Balance** (`vacationBalance`): `status` `ok` | `no-config` (no entitlement for the year:
  `entitlement`, `remainingDays` are `null` = "offen", never 0; taken and planned are still
  counted) | `not-employed` (the employment does not touch the year). Approved (`genehmigt`) and
  planned (`geplant`) vacation in the year are counted separately (an absence across New Year
  counts in each year only its part). `remainingDays = entitlement + carryover − carryoverExpired
− approvedDays`, `remainingAfterPlannedDays = remainingDays − plannedDays`.
- **Carryover** (`carryoverDays`, `null` = none entered, counts 0): approved vacation until 31.03.
  of the year uses it first (`carryoverUsed`). Until the deadline the rest is `carryoverOpen`;
  after 31.03. it is `carryoverExpired` ("verfallen"). Planned vacation does not use carryover.
- **Shifts:** Verkauf only (400 `not_verkauf`), active employees only (409 `employee_inactive`),
  inside the employment period (400 `outside_employment`), `HH:MM`, end after start on the same
  day - no shift past midnight (400 `invalid_time` / `end_before_start`), break a whole number of
  minutes shorter than the shift (400 `invalid_break`), no overlap with another shift of the same
  person on that day (409 `shift_overlap`; 06-12 and 12-18 touch, they do not overlap).
- **Absences:** fully inside the employment period (400 `outside_employment`), at most 366 days,
  end not before start (400 `invalid_range`), `halfDay` only for one day (400 `half_day_range`),
  no overlap with another absence of the same person (409 `absence_overlap` - it would count
  twice).
- **Warnings, not errors** (`warnings: [{ code, message }]` next to `data`): a shift on a day the
  person is absent (`absence_overlap`) or on a closed day (`closed_day`); an absence covering
  shifts of the person (`shift_overlap`, lists the dates).
- **Verkauf besetzt** (`days[].verkaufBesetzt`): Verkauf people with at least one shift that day
  and no whole-day absence (a half-day absence keeps the shift). A quick gap check, no hours.
- **`days[]`**: `{ date, weekday (ISO), holidayName, restDay, closed, weight, halfDayName,
verkaufBesetzt }`. The browser computes no holidays or balances itself.
- **Employee changes:** changing `entryDate`/`exitDate` so that shifts or absences fall outside →
  409 `entries_outside_employment`; moving a person out of Verkauf while they have shifts from
  today on → 409 `has_shifts`. The calendar lists active employees plus inactive ones with entries
  in the range.

## Audit

Every write is one `audit_log` row in the same transaction: `create` / `update` / `delete` on
`shift`, `absence`, `shift_template`, `vacation_entitlement` (entity id `employeeId/year`);
`create` / `update` / `deactivate` / `reactivate` on `employee`. `data` holds the changed fields
(`{ from, to }`), **never a note or a display name** - only `noteChanged` / `nameChanged: true`.

## Tests and seed

`tests/unit/vacationCore.test.js` (Easter and holidays over several years, Ruhetag, half days,
24./31.12., entry/exit mid-year, carryover expiry, no-config), `tests/integration/dienstplan.test.ts`
(401/403 for other roles and PIN sessions, validation, overlaps, warnings, audit without notes,
calendar), `tests/migrations/pilotBaseline.test.ts`. `createApp({ dienstplan: { today, financeDir } })`
pins the clock and the finance dir. The setup-dev seed (`seedDienstplan` in
`.claude/skills/setup-dev/scripts/lib/seed-next.mjs`) creates eight invented people through the
API.
