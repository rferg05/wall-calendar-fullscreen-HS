// What the module reads from the host: events for the days on screen, who's
// in the family, and how the household writes the time.

import { useEffect, useMemo, useState } from 'react';
import type { Config } from './config';
import { fetchWindow } from './dates';
import type { CalendarEvent } from './dates';
import type { Owner } from './merge';

/** How often the module asks the host for events (the host's own calendar poll). */
const FETCH_MS = 5 * 60_000;

/** A household member and the calendars that are theirs (the host's CalendarPerson). */
export interface Person { id: string; name: string; color: string; sourceIds: string[] }
interface FamilyMember { id: string; name: string; color: string }

/** Stands in for the host's fetch hook where there is none (tests). */
const noFetch = <T,>(_url: string | null, _ms: number): [T | null, string | null] => [null, null];

/**
 * Events for exactly the days on screen. The host's `events` prop only runs
 * from today forward (Settings > Calendar > days ahead, 7 by default), which
 * can stop short of a rolling two weeks. So the module asks the host's own
 * `/api/calendar` for its window, through the host's fetch hook, which
 * carries the display's credentials and shares the host's server-side cache.
 * The prop is the fallback until the answer arrives, or if the request fails.
 */
export function useEvents(days: string[], fallback: CalendarEvent[] | undefined) {
  const useFetch = window.__HS_SDK__?.useFetchData ?? noFetch;
  const { timeMin, timeMax } = fetchWindow(days);
  const url = `/api/calendar?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
  const [data, error] = useFetch<{ events?: CalendarEvent[]; error?: string }>(url, FETCH_MS);
  const events = Array.isArray(data?.events) ? data.events : Array.isArray(fallback) ? fallback : undefined;
  return { events, error: !events ? (data?.error ?? error ?? null) : null };
}

/** Settings > Family, for everyone's color. The calendar props only list
 *  people who have a calendar linked; colors there can be older. */
export function usePeople(calendarPeople: Person[] | undefined): Person[] {
  const useFetch = window.__HS_SDK__?.useFetchData ?? noFetch;
  const [family] = useFetch<{ members?: FamilyMember[] }>('/api/family', 5 * 60_000);
  return useMemo(() => {
    const cal = Array.isArray(calendarPeople) ? calendarPeople : [];
    const members = Array.isArray(family?.members) ? family.members : [];
    return cal.map((p) => ({ ...p, color: members.find((m) => m.id === p.id)?.color || p.color }));
  }, [calendarPeople, family]);
}

/**
 * Whose an event is, for merging: the person whose calendar it came from
 * (Settings > Family, with their calendars linked), else the calendar itself.
 * Two calendars linked to one person are one owner, so a duplicate across
 * them is merged without being called shared.
 */
export function ownerFinder(people: Person[], config: Config) {
  return (ev: CalendarEvent): Owner => {
    const person = ev.sourceId ? people.find((p) => p.sourceIds.includes(ev.sourceId!)) : undefined;
    const color = ev.kind === 'holiday' && config.customHolidayColor
      ? config.holidayColor
      : config.colorBy === 'person'
        ? person?.color || ev.calendarColor || config.accentColor
        : ev.calendarColor || person?.color || config.accentColor;
    return { key: person ? `person:${person.id}` : `calendar:${ev.sourceId ?? ev.calendarColor ?? ''}`, color };
  };
}

/** 12- or 24-hour: the module's setting, else the household's, else the locale's. */
function hour12(config: Config, hostFormat: '12h' | '24h' | undefined): boolean | undefined {
  const fmt = config.timeFormat === 'auto' ? hostFormat : config.timeFormat;
  return fmt ? fmt === '12h' : undefined;
}

function partsFormatter(opts: Intl.DateTimeFormatOptions, timezone?: string) {
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone || undefined });
  } catch {
    f = new Intl.DateTimeFormat('en-US', opts);
  }
  return (ms: number) => {
    const v: Record<string, string> = {};
    for (const p of f.formatToParts(new Date(ms))) v[p.type] = p.value;
    return v;
  };
}

/** "7p", "7:30p", or "19:30". Short, because every character costs size. */
export function timeFormatter(config: Config, hostFormat: '12h' | '24h' | undefined, timezone?: string) {
  const h12 = hour12(config, hostFormat);
  const parts = partsFormatter({ hour: 'numeric', minute: '2-digit', ...(h12 === undefined ? {} : { hour12: h12 }) }, timezone);
  return (ms: number) => {
    const v = parts(ms);
    if (!v.dayPeriod) return `${v.hour.padStart(2, '0')}:${v.minute}`;
    return `${v.hour}${v.minute === '00' ? '' : `:${v.minute}`}${v.dayPeriod.charAt(0).toLowerCase()}`;
  };
}

/** The clock's pieces: "6:03" (or "6:03:09"), "PM" (absent on a 24-hour
 *  clock), and "Friday, October 23". */
export function clockFormatter(config: Config, hostFormat: '12h' | '24h' | undefined, timezone?: string) {
  const h12 = hour12(config, hostFormat);
  const parts = partsFormatter({
    hour: 'numeric', minute: '2-digit', second: '2-digit', weekday: 'long', month: 'long', day: 'numeric',
    ...(h12 === undefined ? {} : { hour12: h12 }),
  }, timezone);
  return (ms: number) => {
    const v = parts(ms);
    const hour = v.dayPeriod ? v.hour : v.hour.padStart(2, '0');
    return {
      time: `${hour}:${v.minute}${config.clockSeconds ? `:${v.second}` : ''}`,
      period: v.dayPeriod ?? '',
      date: `${v.weekday}, ${v.month} ${v.day}`,
    };
  };
}

/** "in 25 min", "in 1h 20m", "in 3h"; null once it's 10 hours or more away. */
export function countdown(ms: number): string | null {
  const min = Math.ceil(ms / 60_000);
  if (min <= 1) return 'in 1 min';
  if (min < 60) return `in ${min} min`;
  if (min >= 600) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/** The size of an element, kept up to date. */
export function useBoxSize(ref: React.RefObject<HTMLDivElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
