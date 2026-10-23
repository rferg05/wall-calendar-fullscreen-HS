// Which days are on screen, and which events fall on each of them. Days are
// "YYYY-MM-DD" keys on the household's wall clock (Settings > timezone), not
// the Pi's: a Pi left on UTC would otherwise move a Chicago evening event to
// the next day. Pure functions, so they can be tested without a host.

import type { Config, View } from './config';

/** The host's CalendarEvent, as much of it as this module reads. */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  allDay: boolean;
  calendarColor?: string;
  sourceId?: string;
  sourceName?: string;
  kind?: 'birthday' | 'holiday' | 'event';
  /** Set by the host's event rules: replaces the color dot. */
  icon?: string;
}

const DAY_MS = 86_400_000;

const keyFormatters = new Map<string, Intl.DateTimeFormat>();

/** The household's calendar date at an instant. */
export function wallDate(ms: number, timezone?: string): string {
  const zone = timezone || '';
  let f = keyFormatters.get(zone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: zone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      // An unknown zone name: the display's own clock is the best guess left.
      f = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    keyFormatters.set(zone, f);
  }
  const v: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) v[p.type] = p.value;
  return `${v.year}-${v.month}-${v.day}`;
}

/** A day key as UTC midnight, for day arithmetic that never meets DST. */
export function keyToUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** How far the household's clock is ahead of UTC at an instant, in ms. */
function zoneOffset(ms: number, timezone?: string): number {
  const zone = timezone || '';
  let f = offsetFormatters.get(zone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: zone || undefined, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return -new Date(ms).getTimezoneOffset() * 60_000;
    }
    offsetFormatters.set(zone, f);
  }
  const v: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) v[p.type] = Number(p.value);
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - Math.floor(ms / 1000) * 1000;
}

/** The instant a day starts on the household's clock: its midnight, not
 *  UTC's. An all-day event ends at the next one; ending it at UTC midnight
 *  instead grayed today's all-day events out at 7 pm in Chicago. */
export function dayStartMs(key: string, timezone?: string): number {
  const utc = keyToUtc(key);
  // Twice, so a day whose offset differs from UTC midnight's (DST) lands right.
  let ms = utc - zoneOffset(utc, timezone);
  ms = utc - zoneOffset(ms, timezone);
  return ms;
}

export function addDays(key: string, n: number): string {
  return new Date(keyToUtc(key) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday. */
export function weekday(key: string): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);
}

/** The days on screen: today and the 6 (or 13) after it. */
export function rollingDays(view: View, today: string): string[] {
  const count = view === 'twoWeeks' ? 14 : 7;
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

/**
 * The `/api/calendar` window for the drawn days. Padded a day each side so a
 * gap between the Pi's zone and the household's can't cut off an edge day,
 * and whole UTC days so the URL stays the same all day: a URL that changed
 * every render would make the host refetch in a loop.
 */
export function fetchWindow(days: string[]): { timeMin: string; timeMax: string } {
  return {
    timeMin: new Date(keyToUtc(days[0]) - DAY_MS).toISOString(),
    timeMax: new Date(keyToUtc(days[days.length - 1]) + 2 * DAY_MS).toISOString(),
  };
}

/** Whether the event renders as all-day: the flag, or a date-only start. */
export function isAllDay(ev: CalendarEvent): boolean {
  return ev.allDay === true || !ev.start.includes('T');
}

/** First and last day an event covers, inclusive. All-day ends are exclusive
 *  dates (a one-day event on the 7th ends on the 8th); a timed event ending
 *  exactly at midnight doesn't reach into the next day. */
export function eventSpan(ev: CalendarEvent, timezone?: string): { from: string; to: string } | null {
  if (isAllDay(ev)) {
    const from = ev.start.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
    const endKey = (ev.end ?? '').slice(0, 10);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(endKey) && endKey > from ? addDays(endKey, -1) : from;
    return { from, to };
  }
  const start = Date.parse(ev.start);
  if (!Number.isFinite(start)) return null;
  const endMs = Date.parse(ev.end);
  const from = wallDate(start, timezone);
  const to = Number.isFinite(endMs) && endMs > start ? wallDate(endMs - 1, timezone) : from;
  return { from, to: to < from ? from : to };
}

export interface DayEvent<E extends CalendarEvent = CalendarEvent> {
  event: E;
  allDay: boolean;
  startMs: number;
  endMs: number;
  /** Starts on this day (false on the later days of a multi-day event). */
  first: boolean;
  /** Ends on this day. */
  last: boolean;
}

export type EventFilter = Pick<Config, 'showHolidays' | 'showBirthdays' | 'hideWords'>;

export function keepEvent(ev: CalendarEvent, filter: EventFilter): boolean {
  if (!ev || typeof ev.start !== 'string') return false;
  if (ev.kind === 'holiday' && !filter.showHolidays) return false;
  if (ev.kind === 'birthday' && !filter.showBirthdays) return false;
  const title = (ev.title ?? '').toLowerCase();
  return !filter.hideWords.some((w) => title.includes(w));
}

/**
 * Each drawn day's events: all-day first, then by start time, then by title.
 * Duplicates are merged before this (merge.ts).
 */
export function eventsByDay<E extends CalendarEvent>(
  events: E[] | undefined,
  days: string[],
  filter: EventFilter,
  timezone?: string,
): Map<string, DayEvent<E>[]> {
  const out = new Map<string, DayEvent<E>[]>(days.map((d) => [d, []]));
  if (!Array.isArray(events) || days.length === 0) return out;
  const first = days[0];
  const last = days[days.length - 1];
  for (const ev of events) {
    if (!keepEvent(ev, filter)) continue;
    const span = eventSpan(ev, timezone);
    if (!span || span.to < first || span.from > last) continue;
    const allDay = isAllDay(ev);
    const startMs = allDay ? dayStartMs(span.from, timezone) : Date.parse(ev.start);
    const endMs = allDay ? dayStartMs(addDays(span.to, 1), timezone) : Date.parse(ev.end);
    for (let d = span.from < first ? first : span.from; d <= span.to && d <= last; d = addDays(d, 1)) {
      out.get(d)?.push({ event: ev, allDay, startMs, endMs, first: d === span.from, last: d === span.to });
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => (a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : 0)
      || (a.allDay ? 0 : a.startMs - b.startMs)
      || (a.event.title ?? '').localeCompare(b.event.title ?? ''));
  }
  return out;
}
