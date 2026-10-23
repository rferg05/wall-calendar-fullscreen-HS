import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import { clockFormatter, countdown } from './data';

const MIN = 60_000;

describe('countdown', () => {
  it('counts minutes, then hours and minutes, and stops at 10 hours', () => {
    expect(countdown(20_000)).toBe('in 1 min');
    expect(countdown(25 * MIN)).toBe('in 25 min');
    expect(countdown(80 * MIN)).toBe('in 1h 20m');
    expect(countdown(180 * MIN)).toBe('in 3h');
    expect(countdown(600 * MIN)).toBeNull();
  });
});

describe('clockFormatter', () => {
  const at = Date.parse('2026-10-23T18:03:09-05:00');
  it('splits the time from AM/PM, on the household clock', () => {
    expect(clockFormatter(readConfig({}), '12h', 'America/Chicago')(at))
      .toEqual({ time: '6:03', period: 'PM', date: 'Friday, October 23' });
  });
  it('shows seconds and a 24-hour clock when asked', () => {
    expect(clockFormatter(readConfig({ clockSeconds: true, timeFormat: '24h' }), '12h', 'America/Chicago')(at))
      .toEqual({ time: '18:03:09', period: '', date: 'Friday, October 23' });
  });
});
