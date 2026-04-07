/**
 * US Federal & German Public holidays for the capacity planner.
 *
 * All dates returned as YYYY-MM-DD strings so they can be compared
 * directly against capacity entry dates.
 */

export interface Holiday {
  date: string;        // YYYY-MM-DD
  name: string;
  nameDE?: string;     // German name (if German holiday)
  country: "US" | "DE" | "BOTH";
}

// ── Easter (Anonymous Gregorian algorithm) ──────────────────────
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Nth weekday of a month (e.g., 3rd Monday of January) */
function nthWeekdayOf(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  let diff = (weekday - first.getDay() + 7) % 7;
  const d = new Date(year, month, 1 + diff + (n - 1) * 7);
  return d;
}

/** Last weekday of a month (e.g., last Monday of May) */
function lastWeekdayOf(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0); // last day of month
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - diff);
}

// ── Holiday generators ──────────────────────────────────────────

function usHolidays(year: number): Holiday[] {
  return [
    { date: `${year}-01-01`, name: "New Year's Day", country: "US" },
    { date: fmt(nthWeekdayOf(year, 0, 1, 3)), name: "Martin Luther King Jr. Day", country: "US" },
    { date: fmt(nthWeekdayOf(year, 1, 1, 3)), name: "Presidents' Day", country: "US" },
    { date: fmt(lastWeekdayOf(year, 4, 1)), name: "Memorial Day", country: "US" },
    { date: `${year}-06-19`, name: "Juneteenth", country: "US" },
    { date: `${year}-07-04`, name: "Independence Day", country: "US" },
    { date: fmt(nthWeekdayOf(year, 8, 1, 1)), name: "Labor Day", country: "US" },
    { date: fmt(nthWeekdayOf(year, 9, 1, 2)), name: "Columbus Day", country: "US" },
    { date: `${year}-11-11`, name: "Veterans Day", country: "US" },
    { date: fmt(nthWeekdayOf(year, 10, 4, 4)), name: "Thanksgiving", country: "US" },
    { date: `${year}-12-25`, name: "Christmas Day", country: "US" },
  ];
}

function deHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { date: `${year}-01-01`, name: "New Year's Day", nameDE: "Neujahrstag", country: "DE" },
    { date: fmt(addDaysToDate(easter, -2)), name: "Good Friday", nameDE: "Karfreitag", country: "DE" },
    { date: fmt(addDaysToDate(easter, 1)), name: "Easter Monday", nameDE: "Ostermontag", country: "DE" },
    { date: `${year}-05-01`, name: "Labour Day", nameDE: "Tag der Arbeit", country: "DE" },
    { date: fmt(addDaysToDate(easter, 39)), name: "Ascension Day", nameDE: "Christi Himmelfahrt", country: "DE" },
    { date: fmt(addDaysToDate(easter, 50)), name: "Whit Monday", nameDE: "Pfingstmontag", country: "DE" },
    { date: `${year}-10-03`, name: "German Unity Day", nameDE: "Tag der Deutschen Einheit", country: "DE" },
    { date: `${year}-12-25`, name: "Christmas Day", nameDE: "1. Weihnachtstag", country: "DE" },
    { date: `${year}-12-26`, name: "St. Stephen's Day", nameDE: "2. Weihnachtstag", country: "DE" },
  ];
}

/**
 * Get all holidays for one or more years, merged and deduplicated.
 * Holidays that fall on the same date in both countries get country: "BOTH".
 */
export function getHolidays(years: number[]): Holiday[] {
  const map = new Map<string, Holiday>();

  for (const year of years) {
    for (const h of usHolidays(year)) {
      const existing = map.get(h.date);
      if (existing && existing.country === "DE") {
        // Same date exists in DE — merge to BOTH
        map.set(h.date, {
          date: h.date,
          name: `${h.name} / ${existing.nameDE || existing.name}`,
          country: "BOTH",
        });
      } else if (!existing) {
        map.set(h.date, h);
      }
    }
    for (const h of deHolidays(year)) {
      const existing = map.get(h.date);
      if (existing && existing.country === "US") {
        // Same date exists in US — merge to BOTH
        map.set(h.date, {
          date: h.date,
          name: `${existing.name} / ${h.nameDE || h.name}`,
          nameDE: h.nameDE,
          country: "BOTH",
        });
      } else if (!existing) {
        map.set(h.date, h);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build a quick lookup map: date → Holiday
 */
export function holidayMap(years: number[]): Map<string, Holiday> {
  const holidays = getHolidays(years);
  const m = new Map<string, Holiday>();
  for (const h of holidays) m.set(h.date, h);
  return m;
}
