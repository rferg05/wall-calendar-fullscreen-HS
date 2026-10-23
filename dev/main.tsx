import React from 'react';
import { createRoot } from 'react-dom/client';
import manifest from '../manifest.json';
import WallCalendarFullScreen from '../src/index';
import { addDays, wallDate } from '../src/dates';
import { makeHostDisplayCache } from './host-cache';

// Stand-in for the host: just enough SDK for the module to run.
// `?w=&h=` module size, `fs=` text size, `bg=bright|busy|dark|night` background,
// `tz=` timezone, and any config key (`view=twoWeeks`, `dayBackdrop=20`...).
const params = new URLSearchParams(location.search);
const timezone = params.get('tz') ?? 'America/Chicago';
document.body.className = params.get('bg') ?? 'night';

const today = wallDate(Date.now(), timezone);
/** An instant on the household's wall clock, `days` from today at `hhmm`. */
const at = (days: number, hhmm: string) => {
  const day = addDays(today, days);
  // Chicago is UTC-5 in daylight time, -6 in standard; close enough for a preview.
  return new Date(`${day}T${hhmm}:00-05:00`).toISOString();
};
/** `min` minutes from now, for today's events around the now line. */
const inMin = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
const allDay = (days: number, len = 1) => ({ start: addDays(today, days), end: addDays(today, days + len), allDay: true });

const RYAN = 'cal-ryan';
const AUDRA = 'cal-audra';
const RYAN_GOOGLE = 'cal-ryan-google';
const SHARED = 'cal-family';
const COLORS: Record<string, string> = { [RYAN]: '#f97316', [RYAN_GOOGLE]: '#f59e0b', [AUDRA]: '#3b82f6', [SHARED]: '#22c55e' };
const ev = (id: string, title: string, src: string, when: { start: string; end: string; allDay?: boolean; kind?: 'holiday' }, location?: string) => ({
  id, title, sourceId: src, calendarColor: COLORS[src], location, allDay: false, ...when,
});

const EVENTS = [
  ev('a', 'Indoor volleyball', RYAN, { start: at(-1, '19:00'), end: at(-1, '21:00') }, 'Lakeview Athletic Club, Chicago'),
  ev('b', 'Mandy hang', AUDRA, { start: at(0, '08:00'), end: at(0, '09:30') }),
  // Today, around now: one done, one under way, one next, one tonight.
  ev('c', 'Dentist', RYAN, { start: inMin(-150), end: inMin(-90) }, '30 N Michigan Ave, Chicago'),
  ev('now', 'Jenny & Callie hang', RYAN, { start: inMin(-25), end: inMin(35) }, 'Lula Cafe, Chicago'),
  ev('next', 'Pick up dry cleaning', RYAN, { start: inMin(50), end: inMin(65) }),
  ev('late', 'You Can See Everything', SHARED, { start: inMin(220), end: inMin(330) }, 'Music Box Theatre, Chicago'),
  ev('allday', 'Trash & recycling day', SHARED, allDay(0)),
  // The same booking, added by the restaurant site and by Gmail: shown once.
  ev('d', 'Reservation at Avec', RYAN, { start: at(1, '19:30'), end: at(1, '21:30') }),
  ev('d2', 'Reservation: Avec', RYAN_GOOGLE, { start: at(1, '19:30'), end: at(1, '21:00') }, '615 W Randolph St, Chicago'),
  // On both calendars, one still carrying the calendar filter's ~: shown once, as shared.
  ev('gala', 'Gala ~', RYAN, { start: at(2, '19:00'), end: at(2, '23:00') }),
  ev('gala2', 'Gala', AUDRA, { start: at(2, '19:00'), end: at(2, '23:00') }),
  ev('dinner', 'Dinner with the Parks', RYAN, { start: at(6, '18:30'), end: at(6, '20:30') }),
  ev('dinner2', 'Dinner w/ the Parks ~', AUDRA, { start: at(6, '18:30'), end: at(6, '20:30') }),
  ev('trip', 'Weekend away', AUDRA, allDay(12, 2)),
  ev('trip2', 'Weekend away ~', RYAN, allDay(12, 2)),
  ev('e', "Gabby's birthday party", SHARED, { start: at(2, '13:00'), end: at(2, '16:00') }),
  ev('f', "Anya's Halloween costume swap", AUDRA, { start: at(2, '18:00'), end: at(2, '20:00') }),
  ev('g', 'Pumpkin patch with the Hendersons', SHARED, { start: at(2, '10:00'), end: at(2, '12:00') }),
  ev('h', 'Trash night', SHARED, { start: at(3, '20:00'), end: at(3, '20:30') }),
  ev('i', 'Halloween', SHARED, { ...allDay(9), kind: 'holiday' }),
  ev('j', 'Parent-teacher conferences', AUDRA, { start: at(5, '16:00'), end: at(5, '17:00') }),
  ev('k', 'Cubs watch party', RYAN, { start: at(6, '18:00'), end: at(6, '22:00') }),
  ev('l', 'Book club', AUDRA, { start: at(7, '19:00'), end: at(7, '21:00') }),
  ev('m', 'Weekend in Door County', SHARED, allDay(10, 3)),
  ev('n', 'Flu shots', SHARED, { start: at(4, '09:00'), end: at(4, '09:30') }),
  ev('o', 'Standup', RYAN, { start: at(4, '09:30'), end: at(4, '09:45') }),
  ev('p', 'Lunch with Sam', RYAN, { start: at(4, '12:00'), end: at(4, '13:00') }),
  ev('q', 'Soccer practice', AUDRA, { start: at(4, '17:30'), end: at(4, '19:00') }),
  ev('r', 'Date night', SHARED, { start: at(4, '19:30'), end: at(4, '22:00') }),
  ev('s', 'Haircut', AUDRA, { start: at(-3, '11:00'), end: at(-3, '11:45') }),
  ev('t', 'Pay rent', SHARED, allDay(-4)),
  ev('u', 'Housewarming at Jess & Kai', SHARED, { start: at(15, '18:00'), end: at(15, '22:00') }),
  ev('v', 'Thanksgiving planning call', RYAN, { start: at(20, '19:00'), end: at(20, '20:00') }),
];

(window as unknown as { React: typeof React }).React = React;
(window as unknown as { __HS_SDK__: unknown }).__HS_SDK__ = {
  displayCache: makeHostDisplayCache(),
  // The host's fetch hook: answers the calendar window and Settings > Family.
  useFetchData: (url: string | null) => {
    if (url?.startsWith('/api/calendar')) {
      const q = new URL(url, location.origin).searchParams;
      const [min, max] = [Date.parse(q.get('timeMin') ?? ''), Date.parse(q.get('timeMax') ?? '')];
      return [{ events: EVENTS.filter((e) => Date.parse(e.end) > min && Date.parse(e.start) < max) }, null];
    }
    if (url === '/api/family') return [FAMILY, null];
    return [null, null];
  },
};

const FAMILY = { members: [
  { id: 'p1', name: 'Ryan', color: '#f97316' },
  { id: 'p2', name: 'Audra', color: '#3b82f6' },
] };
const people = [
  { id: 'p1', name: 'Ryan', color: '#f97316', sourceIds: [RYAN, RYAN_GOOGLE] },
  { id: 'p2', name: 'Audra', color: '#3b82f6', sourceIds: [AUDRA] },
];

const style = {
  fontSize: Number(params.get('fs') ?? 16), fontFamily: 'inter', textColor: '#ffffff',
  backgroundColor: manifest.defaultStyle.backgroundColor, borderRadius: 12, padding: manifest.defaultStyle.padding,
  opacity: 1, backdropBlur: 12,
};
const w = Number(params.get('w') ?? manifest.defaultSize.w);
const h = Number(params.get('h') ?? manifest.defaultSize.h);
const config = {
  ...manifest.defaultConfig,
  ...Object.fromEntries([...params].filter(([k]) => !['w', 'h', 'fs', 'bg', 'tz'].includes(k))),
};

createRoot(document.getElementById('root')!).render(
  <div style={{ width: w, height: h }}>
    <WallCalendarFullScreen config={config} style={style} events={[]} people={people} timezone={timezone} />
  </div>,
);
