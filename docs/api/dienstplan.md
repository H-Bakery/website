# Dienstplan und Urlaub (TASK-042)

Roadmap §6 M5 candidate, originally out of the pilot (D11); now im Pilot für den Inhaber
freigegeben (Entscheidung 2026-11-08). The owner plans who works when (shifts, every area since
the owner's decision of 2026-11-08 - before: Verkauf only), who is away (urlaub / frei /
abwesend), sees the opening hours with the Verkauf coverage per day and the planned hours per
person next to the contractual target, and keeps a vacation account per person and year. Task and decisions:
`.mc/tasks/done/TASK-042-dienstplan-urlaub-mitarbeiterprofile.md` (section "Entscheidungen").

Code in `apps/bakery-api/`: rules and formulas **once** in `src/services/vacation.core.js`
(dependency-free, `tests/unit/vacationCore.test.js`), the weekly opening hours **once** in
`src/services/opening-hours.core.js` (the landing page keeps a copy, checked by
`apps/bakery-landing/src/config/openingHours.spec.ts`); DB, validation, transaction and audit in
`src/services/dienstplan.service.ts`; routes in `src/routes/dienstplan.routes.ts`
(`createDienstplanRouter(options)`, mounted by `app.ts` below the session guard); integration
tests `tests/integration/dienstplan.test.ts`.

**Access:** `inhaber` from a **personal session** only (`requireRole('inhaber')` +
`requirePersonalSession` on the whole router) - staff data is not opened by a PIN at a station.
Other roles 403 `forbidden`, a PIN session 403 `personal_session_required`, no session 401.

**Personal data stays in the box's SQLite** (D13) - never in hq. No phone, address, IBAN, tax id
or health data (there is no "krank"); this repo, its tests and the setup-dev seed use invented
people only.

| Endpoint                                                         | Answer (`{ success, data }`, writes may add `warnings`)                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/dienstplan?from=&to=`                                  | calendar: `{ from, to, today, closedWeekdays, employees[], shifts[], absences[], days[], hours[] }`                                 |
| `GET /api/dienstplan/employees`                                  | all employees (incl. deactivated), Verkauf first, then Backstube, Fahrer, Büro; by name                                             |
| `POST /api/dienstplan/employees`                                 | `{ displayName, area, color?, employmentType?, weeklyHours?, entryDate?, exitDate?, userId?, note? }` → 201                         |
| `GET /api/dienstplan/employees/:id?year=`                        | profile: `{ employee, year, entitlements[], balance, absences[] (of the year), upcomingShifts[] (≤ 20), hours, closedWeekdays }`    |
| `PATCH /api/dienstplan/employees/:id`                            | any of the fields above + `active`; `active: false` deactivates. **No DELETE** (404)                                                |
| `GET /api/dienstplan/employees/:id/entitlements`                 | `[{ employeeId, year, entitlementDays, carryoverDays }]`, newest year first                                                         |
| `PUT /api/dienstplan/employees/:id/entitlements/:year`           | `{ entitlementDays?, carryoverDays? }` (number 0-365 or `null` = offen); upsert of that year's row                                  |
| `GET/POST /api/dienstplan/shift-templates`, `PATCH/DELETE …/:id` | `{ id, name, startTime, endTime, breakMinutes }`                                                                                    |
| `GET /api/dienstplan/shifts?from=&to=[&employeeId=]`             | `[{ id, employeeId, date, startTime, endTime, breakMinutes, minutes, note }]`                                                       |
| `POST /api/dienstplan/shifts`, `PATCH/DELETE …/:id`              | `{ employeeId, date, startTime?, endTime?, breakMinutes?, templateId?, note? }` - times from the template unless given              |
| `GET /api/dienstplan/absences?from=&to=[&employeeId=]`           | overlapping the range: `[{ id, employeeId, type, status, startDate, endDate, halfDay, days, note }]`                                |
| `POST /api/dienstplan/absences`, `PATCH/DELETE …/:id`            | `{ employeeId, type, status?, startDate, endDate?, halfDay?, note? }` - `status` default `geplant`, `endDate` default `startDate`   |
| `GET /api/dienstplan/balance?year=[&employeeId=]`                | one balance, or a list of all employees employed in that year (`+ displayName, area, active`)                                       |
| `GET /api/dienstplan/hours?week=\|month=[&area=]`                | `{ today, area, periods: { week \| null, month }, closedWeekdays, employees[], rows[], totals }` - hours and estimated overtime pay |

The profile's `hours` is `{ week, month }`: the current week (Mon-Sun) as `plannedHours` (below)
plus `pay` (`overtimePay`), and the current month (Berlin today) as `monthHours` (through today,
whole month in `full`, wage costs, Minijob check), independent of `year`.

`/hours`: `week=JJJJ-MM-TT` (any day) → that week and the month of its Thursday (`weekMonth`, ISO
week rule); `month=JJJJ-MM` → only the month (`periods.week: null`). Exactly one of them, years
2000-2100 (else 400 `invalid_period`); `area` one of the areas or `alle` (else 400 `invalid_area`)
filters rows and totals. Employees as in the calendar (active + inactive with entries in the
range). Each row `{ employeeId, hourlyWageCents, week?, month }`: `week` = `plannedHours` + `pay`
(indicative only), `month` = `monthHours` (below); `totals.week|month` from `hoursOverview`. The
service passes `today` (`this.today()`, the box's date) into the core.

In the profile each absence also carries `daysInYear`: its vacation days inside the shown year
(the part the balance counts), next to `days` for the whole range - they differ for an absence
across New Year.

Ranges (`from`/`to`) are required, `from ≤ to`, at most 366 days (400 `invalid_range`). `year`
defaults to the current year (Berlin), 2000-2100 (400 `invalid_year`).

## Model

Migration `20270301000000-dienstplan.js` (additive, idempotent), models `Employee`,
`VacationEntitlement`, `ShiftTemplate`, `Shift`, `Absence`:

- `employees` - `display_name` (authoritative), `area` `verkauf|backstube|fahrer|buero`, `color`
  `#RRGGBB`, `employment_type` `vollzeit|teilzeit|minijob|aushilfe`, `weekly_hours`,
  `hourly_wage_cents` (gross hourly wage in cents, `NULL` = offen; migration
  `20270401000000-dienstplan-hourly-wage.js`: plain `ADD COLUMN`, no backfill, no table rebuild,
  idempotent, `down()` drops the column in place),
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
  year (15.03. → 15.03.-14.04. is one month). A start day missing in the target month ends that
  month on the month's last day (§ 188 Abs. 3 BGB: 31.01. → 31.01.-28.02., 31.03. → 31.03.-30.04.).
  Rounding § 5 Abs. 2 BUrlG: a fraction of at least half a day rounds up to a full day; smaller
  fractions stay (2 decimals), they are never rounded down. The owner decided this for entry
  **and** exit. The statutory minimum can be higher: § 5 Abs. 1 BUrlG prorates only when the
  six-month waiting period is not completed in the year, so a person who enters before 1 July, or
  leaves in the second half of the year after the waiting period, is owed the full statutory
  minimum - the owner then enters the higher amount as that year's entitlement.
- **Balance** (`vacationBalance`): `status` `ok` | `no-config` (no entitlement for the year:
  `entitlement`, `remainingDays` are `null` = "offen", never 0; taken and planned are still
  counted) | `not-employed` (the employment does not touch the year). Approved (`genehmigt`) and
  planned (`geplant`) vacation in the year are counted separately (an absence across New Year
  counts in each year only its part). `remainingDays = entitlement + carryover − carryoverExpired
− approvedDays`, `remainingAfterPlannedDays = remainingDays − plannedDays`.
- **Carryover** (`carryoverDays`, `null` = none entered, counts 0 in `remainingDays`): approved
  vacation until 31.03. of the year uses it first (`carryoverUsed`). Until the deadline the rest
  is `carryoverOpen`; after 31.03. it is `carryoverExpired` ("verfallen"). Planned vacation does
  not use carryover. Without an entered carryover `carryoverUsed`, `carryoverExpired` and
  `carryoverOpen` are `null` (nothing to show), not 0.
- **Shifts:** every area (the former 400 `not_verkauf` is gone since 2026-11-08), active employees
  only (409 `employee_inactive`),
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
- **Opening hours** (`days[].openingHours`, `opening-hours.core.js`): Tue-Fri 05:30-13:30, Sat
  05:30-12:30, Sun 08:00-11:00, Mon none. `{ opens, closes }` on open days, `null` on closed days
  (Ruhetag or holiday) - and on an open day whose weekday has no hours in the table (a finance
  config that opens Monday): "not on file", no estimate.
- **Verkauf besetzt** (`days[].verkaufBesetzt`): Verkauf people with at least one shift that day
  and no whole-day absence (a half-day absence keeps the shift). Only Verkauf counts, although
  every area has shifts.
- **Besetzung** (`days[].besetzung`, `verkaufCoverage`): `null` without opening hours, else
  `{ opens, closes, segments: [{ from, to, employeeIds }], gaps: [{ from, to }], covered }`.
  `segments` cover the opening hours without a hole, one per stretch with the same Verkauf people
  (ids by shift start, empty = unbesetzt); the same shifts as `verkaufBesetzt`, start to end
  (the break has no time of day and is no gap), clipped to the opening hours.
- **Hours** (`hours[]`, `plannedHours` / `hoursByEmployee`), one per shown employee for
  `from`…`to`: `{ employeeId, from, to, weeklyHours, plannedMinutes, shiftCount, targetMinutes,
diffMinutes, targetDays, creditedDays, status }`. Plan = Σ (end − start − break) of the person's
  shifts in the range (any area, also on an absence or closed day). Target = weeklyHours × 60 ÷
  open weekdays (6 with Ruhetag Monday) per opening day in the range inside the employment (day
  weight: 24./31.12. 0.5, Ruhetag/holiday 0), minus days with `urlaub` or `abwesend` (planned or
  approved; a half day counts half; `frei` does not reduce the target) - `creditedDays`. A full
  week without holidays is exactly weeklyHours, a month averages weeklyHours × 13/3. Without
  `weeklyHours`: `status: 'no-target'`, `targetMinutes`/`diffMinutes` `null` ("offen"), never 0.
  `diffMinutes` = plan − target. Actual hours (time clock) are a later stage.
- **Overtime pay** (`overtimePay(hours, hourlyWageCents)`): overtime = `max(0, diffMinutes)`;
  `status` `ok` (`amountCents = round(overtime × cents ÷ 60)`) | `no-overtime` (0) | `no-wage`
  (overtime but no wage: `amountCents: null`, never 0) | `no-target` (no weekly hours). No
  surcharges, no carry-over between months - an estimate from the plan.
- **Month** (`monthHours({ month, today, employee, shifts, absences, closedWeekdays })`,
  provisional 2026-11-14): `phase` = `monthPhase(month, today)` `past` | `current` | `future`
  (`today` is required - the core never reads the clock; missing → `TypeError`). The
  `plannedHours` fields cover the counted range: `current` → first of the month … `today`
  (inclusive), else the whole month; `asOf` = `today` when current; `full` = `plannedHours` of the
  whole month. `pay` = `overtimePay` of the counted range - net within the month (minus hours of
  one week offset overtime of another); `future` → `{ status: 'future', overtimeMinutes: null,
  amountCents: null }`. `wageCost: { toDate (null when future), full }` from `wageCost(minutes,
  wage)` = round(plan × wage ÷ 60), `status` `ok` | `no-wage` (planned hours without a wage:
  `amountCents: null`, never 0; nothing planned = 0). `minijob` only for `employmentType:
  'minijob'`: `minijobCheck(wageCost.full, year)` → `{ status: ok | over | no-wage | no-limit,
  limitCents, plannedCostCents, overCents }`; over = strictly above the limit.
  `MINIJOB_LIMIT_CENTS` = `{ 2026: 60300 }` (603 €; a year without a value → `no-limit`). `hourlyWageCents` is an
  integer 1-99999 (0,01-999,99 €, `MAX_HOURLY_WAGE_CENTS`; else 400 `validation_failed`), `null`
  clears it. `hoursOverview({ periods: { week?, month? }, today, employees, shifts, absences,
closedWeekdays })` runs `plannedHours` + `overtimePay` for the week and `monthHours` for the
  month and sums `{ plannedMinutes, targetMinutes, overtimeMinutes, amountCents, estimatedCount,
missingWageCount, noTargetCount }` (the month over its counted range): target and overtime only
  over people with a target; `amountCents` only over people with a wage, `null` when overtime
  exists only without a wage. The month totals add `phase`, `asOf`, `full: { plannedMinutes,
targetMinutes, noTargetCount }`, `wageCost: { toDate | null, full }` each `{ amountCents
(known wages only, null if none), missingWageCount }` and `minijob: { count, overCount,
openCount, limitCents }`; a future month has `overtimeMinutes`/`amountCents` `null`. Helpers
  `weekOf`, `monthOf`, `weekMonth`.
- **`days[]`**: `{ date, weekday (ISO), holidayName, restDay, closed, weight, halfDayName,
openingHours, kind, kindLabel, kindDetail, calendar, verkaufBesetzt, besetzung }`.
  **Calendar (Z14):** `closed`, `openingHours` and `kind` (`normal` | `ruhetag` | `geschlossen` |
  `wie-sonntag` | `sonderoeffnung` | `teigtag`) come from `kalender.core.js` `dayKind` when the
  app supplies a calendar (`DienstplanOptions.calendar`, wired in `app.ts` to the Backzettel
  source's `config.calendar`); `calendar` says `ok` | `missing` | `year-missing`. Without a
  calendar: Ruhetag or legal holiday = closed, as before. `weight` (vacation days, target hours)
  never depends on the calendar (provisional, see the domain doc). The `closed_day` warning names
  the reason ("Am 18.11.2026 ist der Laden geschlossen (Inventur)."). The browser computes no holidays, coverage, hours
  or balances itself.
- **Employee changes:** changing `entryDate`/`exitDate` so that shifts or absences fall outside →
  409 `entries_outside_employment`; deactivating them (`active: false`) while they have shifts
  from today on → 409 `has_shifts` (delete the shifts first). Changing the area keeps the shifts
  (since 2026-11-08; they then simply stop counting for Verkauf). The calendar lists active employees plus inactive ones with entries in the range.

## Audit

Every write is one `audit_log` row in the same transaction: `create` / `update` / `delete` on
`shift`, `absence`, `shift_template`, `vacation_entitlement` (entity id `employeeId/year`);
`create` / `update` / `deactivate` / `reactivate` on `employee`. `data` holds the changed fields
(`{ from, to }`), **never a note, a display name or an hourly wage** - only `noteChanged` /
`nameChanged` / `hourlyWageChanged: true`.
A write that changes nothing (a PATCH/PUT with the current values) returns the row unchanged,
without an update and without an audit row. A shift PATCH that only changes the note re-checks
nothing and returns no warnings.

## Tests and seed

`tests/unit/vacationCore.test.js` (Easter and holidays over several years, Ruhetag, half days,
24./31.12., entry/exit mid-year, carryover expiry, no-config, opening hours, Besetzung, planned vs.
target hours, overtime pay incl. a missing wage, month boundaries and a week across two months,
month through today incl. today = first/last day, netting within the month, future month, wage
costs with open wages, Minijob limit exact/over),
`tests/integration/dienstplan.test.ts` (401/403 for other roles and PIN sessions, validation,
overlaps, warnings, audit without notes, calendar with opening hours, Besetzung and hours, profile
hours, hourly wage validation and audit, `/hours` incl. current/past/future month, wage costs
and the Minijob limit), `tests/migrations/pilotBaseline.test.ts`
(also: existing employees keep their rows, wage `NULL`). `createApp({ dienstplan: { today, financeDir } })`
pins the clock and the finance dir. The setup-dev seed (`seedDienstplan` in
`.claude/skills/setup-dev/scripts/lib/seed-next.mjs`) creates eight invented people with invented
hourly wages (two left open) through the API.
