/**
 * @file: _dateUtils.ts
 * @description: ISO date string helpers used across route modules (messages, schedule)
 * @dependencies: none
 * @created: 2026-03-18
 */

/** Add `days` to a YYYY-MM-DD string, returns a new YYYY-MM-DD string. Works in UTC. */
export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Difference in calendar days between two YYYY-MM-DD strings (d2 − d1). */
export function differenceInDaysISO(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(`${dateStr1}T00:00:00Z`);
  const d2 = new Date(`${dateStr2}T00:00:00Z`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
    throw new Error(`Invalid date: ${dateStr1} or ${dateStr2}`);
  }
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/** Returns every YYYY-MM-DD string in the inclusive range [start, end]. */
export function eachDayInRange(start: string, end: string): string[] {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDaysISO(current, 1);
  }
  return days;
}
