import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from './dates';
import { cleanTitle, isShared, mergeEvents, similarTitles } from './merge';
import type { Owner } from './merge';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'x', title: 'Thing', start: '2026-10-23T19:00:00-05:00', end: '2026-10-23T21:00:00-05:00', allDay: false, ...over,
});

// Ryan's Outlook feed and Google calendar are both his; Audra's is hers.
const OWNERS: Record<string, Owner> = {
  outlook: { key: 'person:ryan', color: '#f97316' },
  google: { key: 'person:ryan', color: '#f97316' },
  audra: { key: 'person:audra', color: '#3b82f6' },
};
const ownerOf = (e: CalendarEvent) => OWNERS[e.sourceId ?? ''] ?? { key: `calendar:${e.sourceId}`, color: '#888' };

describe('cleanTitle', () => {
  it('drops the calendar filter\'s ~ marker', () => {
    expect(cleanTitle('Gala ~')).toBe('Gala');
    expect(cleanTitle('Gala~')).toBe('Gala');
    expect(cleanTitle('~ Gala')).toBe('Gala');
    expect(cleanTitle('Approx ~2h hike')).toBe('Approx ~2h hike');
  });
});

describe('similarTitles', () => {
  it('matches the same booking worded two ways', () => {
    expect(similarTitles('Reservation at Restaurant Name', 'Reservation: Restaurant Name')).toBe(true);
    expect(similarTitles('Gala ~', 'Gala')).toBe(true);
    expect(similarTitles('Dinner', 'Dinner with Sam')).toBe(true);
    expect(similarTitles("Gabby's party", 'Gabby party')).toBe(true);
  });
  it('keeps different events apart', () => {
    expect(similarTitles('Soccer practice', 'Soccer game')).toBe(false);
    expect(similarTitles('Dentist', 'Doctor')).toBe(false);
  });
});

describe('mergeEvents', () => {
  it('merges one person\'s near-duplicates without calling them shared', () => {
    const out = mergeEvents([
      ev({ id: '1', title: 'Reservation at Avec', sourceId: 'outlook' }),
      ev({ id: '2', title: 'Reservation: Avec', sourceId: 'google', start: '2026-10-23T19:00:00-05:00', location: '615 W Randolph St' }),
    ], ownerOf);
    expect(out).toHaveLength(1);
    expect(out[0].location).toBe('615 W Randolph St');
    expect(isShared(out[0])).toBe(false);
  });
  it('marks an event on two people\'s calendars as shared, without the ~', () => {
    const out = mergeEvents([
      ev({ id: '1', title: 'Gala ~', sourceId: 'outlook' }),
      ev({ id: '2', title: 'Gala', sourceId: 'audra' }),
    ], ownerOf);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Gala');
    expect(isShared(out[0])).toBe(true);
    expect(out[0].ownerColors).toEqual(['#f97316', '#3b82f6']);
  });
  it('needs the starts within 15 minutes', () => {
    expect(mergeEvents([
      ev({ id: '1', title: 'Lunch' }),
      ev({ id: '2', title: 'Lunch', start: '2026-10-23T19:30:00-05:00' }),
    ], ownerOf)).toHaveLength(2);
    expect(mergeEvents([
      ev({ id: '1', title: 'Lunch' }),
      ev({ id: '2', title: 'Lunch', start: '2026-10-23T19:10:00-05:00' }),
    ], ownerOf)).toHaveLength(1);
  });
  it('merges all-day events on the same day, not timed with all-day', () => {
    expect(mergeEvents([
      ev({ id: '1', title: 'Halloween', start: '2026-10-31', end: '2026-11-01', allDay: true }),
      ev({ id: '2', title: 'Halloween', start: '2026-10-31', end: '2026-11-01', allDay: true, sourceId: 'audra' }),
      ev({ id: '3', title: 'Halloween', start: '2026-10-31T18:00:00-05:00', end: '2026-10-31T20:00:00-05:00' }),
    ], ownerOf)).toHaveLength(2);
  });
  it('with merging off, merges only exact copies', () => {
    const events = [
      ev({ id: '1', title: 'Reservation at Avec', sourceId: 'outlook' }),
      ev({ id: '2', title: 'Reservation: Avec', sourceId: 'google' }),
      ev({ id: '3', title: 'Gala ~', sourceId: 'outlook', start: '2026-10-24T19:00:00-05:00', end: '2026-10-24T23:00:00-05:00' }),
      ev({ id: '4', title: 'Gala', sourceId: 'audra', start: '2026-10-24T19:00:00-05:00', end: '2026-10-24T23:00:00-05:00' }),
    ];
    const out = mergeEvents(events, ownerOf, false);
    expect(out.map((e) => e.title)).toEqual(['Reservation at Avec', 'Reservation: Avec', 'Gala']);
    expect(isShared(out[2])).toBe(true);
  });
});
