import { describe, expect, it } from 'vitest';
import { DEFAULTS, readConfig } from './config';
import { dayStartMs, eventsByDay, eventSpan, fetchWindow, rollingDays, wallDate } from './dates';
import type { CalendarEvent } from './dates';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'x', title: 'Thing', start: '2026-10-22T19:00:00-05:00', end: '2026-10-22T20:00:00-05:00', allDay: false, ...over,
});

describe('rollingDays', () => {
  it('runs 7 or 14 days from today, across a month end', () => {
    expect(rollingDays('week', '2026-10-28')).toEqual(
      ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
    const two = rollingDays('twoWeeks', '2026-10-23');
    expect(two).toHaveLength(14);
    expect(two[13]).toBe('2026-11-05');
  });
});

describe('fetchWindow', () => {
  it('pads a day each side on whole UTC days', () => {
    expect(fetchWindow(['2026-10-18', '2026-10-24'])).toEqual({
      timeMin: '2026-10-17T00:00:00.000Z', timeMax: '2026-10-26T00:00:00.000Z',
    });
  });
});

describe('days on the household clock', () => {
  it('an evening event stays on its day on a UTC Pi', () => {
    // 7pm Chicago is past midnight UTC.
    expect(wallDate(Date.parse('2026-10-22T19:30:00-05:00'), 'America/Chicago')).toBe('2026-10-22');
  });
  it('all-day ends are exclusive', () => {
    expect(eventSpan(ev({ start: '2026-10-31', end: '2026-11-01', allDay: true }))).toEqual({ from: '2026-10-31', to: '2026-10-31' });
    expect(eventSpan(ev({ start: '2026-11-01', end: '2026-11-04', allDay: true }))).toEqual({ from: '2026-11-01', to: '2026-11-03' });
  });
  it("a day starts at the household's midnight, through DST changes", () => {
    expect(new Date(dayStartMs('2026-10-23', 'America/Chicago')).toISOString()).toBe('2026-10-23T05:00:00.000Z');
    expect(new Date(dayStartMs('2026-11-02', 'America/Chicago')).toISOString()).toBe('2026-11-02T06:00:00.000Z');
    // DST ends at 2 am on Nov 1, after midnight: that midnight is still daylight time.
    expect(new Date(dayStartMs('2026-11-01', 'America/Chicago')).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });
  it("today's all-day event lasts until the household's midnight, not UTC's", () => {
    const [item] = eventsByDay([ev({ start: '2026-10-23', end: '2026-10-24', allDay: true })], ['2026-10-23'], DEFAULTS, 'America/Chicago')
      .get('2026-10-23')!;
    // 7:30 pm in Chicago is past UTC midnight; the event hasn't finished.
    expect(item.endMs).toBeGreaterThan(Date.parse('2026-10-23T19:30:00-05:00'));
    expect(new Date(item.endMs).toISOString()).toBe('2026-10-24T05:00:00.000Z');
  });
  it('a timed event ending at midnight stays on one day', () => {
    expect(eventSpan(ev({ start: '2026-10-22T20:00:00-05:00', end: '2026-10-23T00:00:00-05:00' }), 'America/Chicago'))
      .toEqual({ from: '2026-10-22', to: '2026-10-22' });
  });
});

describe('eventsByDay', () => {
  const days = rollingDays('week', '2026-10-18');
  it('sorts all-day first, then by time', () => {
    const map = eventsByDay([
      ev({ id: '1', title: 'Late', start: '2026-10-22T21:00:00-05:00', end: '2026-10-22T22:00:00-05:00' }),
      ev({ id: '2', title: 'Early', start: '2026-10-22T08:00:00-05:00', end: '2026-10-22T09:00:00-05:00' }),
      ev({ id: '3', title: 'Holiday', start: '2026-10-22', end: '2026-10-23', allDay: true }),
    ], days, DEFAULTS, 'America/Chicago');
    expect(map.get('2026-10-22')!.map((d) => d.event.title)).toEqual(['Holiday', 'Early', 'Late']);
  });
  it('spreads a multi-day event and marks its ends', () => {
    const map = eventsByDay([ev({ start: '2026-10-23', end: '2026-10-26', allDay: true })], days, DEFAULTS);
    expect(map.get('2026-10-23')![0]).toMatchObject({ first: true, last: false });
    expect(map.get('2026-10-24')![0]).toMatchObject({ first: false, last: false });
    expect(map.get('2026-10-22')).toHaveLength(0);
  });
  it('hides by title word and kind', () => {
    const config = readConfig({ hideWords: 'busy, Tentative', showHolidays: false });
    const map = eventsByDay([
      ev({ id: '1', title: 'Busy' }),
      ev({ id: '2', title: 'Tentative: lunch' }),
      ev({ id: '3', title: 'Columbus Day', kind: 'holiday' }),
      ev({ id: '4', title: 'Dinner' }),
    ], days, config, 'America/Chicago');
    expect(map.get('2026-10-22')!.map((d) => d.event.title)).toEqual(['Dinner']);
  });
});

describe('readConfig', () => {
  it('fills gaps and clamps', () => {
    const c = readConfig({ view: 'month', titleLines: '9', dayBackdrop: 'x', dividerWidth: 20 });
    expect(c.view).toBe('week');
    expect(c.titleLines).toBe(4);
    expect(c.dayBackdrop).toBe(DEFAULTS.dayBackdrop);
    expect(c.dividerWidth).toBe(6);
    expect(readConfig({ view: 'twoWeeks' }).view).toBe('twoWeeks');
  });
  it('reads day card styles, clamping numbers and keeping blank colors at their defaults', () => {
    const c = readConfig({ dayBackground: '#1e293b', dayBlur: '50', dayBorderWidth: -2, dayBorderColor: ' ' });
    expect(c.dayBackground).toBe('#1e293b');
    expect(c.dayBlur).toBe(30);
    expect(c.dayBorderWidth).toBe(0);
    expect(c.dayBorderColor).toBe(DEFAULTS.dayBorderColor);
  });
});
