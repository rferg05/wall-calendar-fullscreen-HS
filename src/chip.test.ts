import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import { lengthBarShare, timeRange } from './chip';
import type { Item } from './chip';
import { lengthHeight } from './index';

const HOUR = 3_600_000;
const item = (hours: number, allDay = false) => ({ startMs: 0, endMs: hours * HOUR, allDay }) as Item;

describe('timeRange', () => {
  it('drops the first am/pm when both share it', () => {
    expect(timeRange('5:30p', '7p')).toBe('5:30–7p');
    expect(timeRange('11a', '1p')).toBe('11a–1p');
    expect(timeRange('17:30', '19:00')).toBe('17:30–19:00');
    expect(timeRange('9p', '…')).toBe('9p–…');
  });
});

describe('lengthHeight', () => {
  it('grows with the length, up to a cap, and eases off with the factor', () => {
    expect(lengthHeight(item(1), 1)).toBe('1.80em');
    expect(lengthHeight(item(3), 1)).toBe('5.40em');
    expect(lengthHeight(item(8), 1)).toBe('7.00em');
    expect(lengthHeight(item(3), 0.5)).toBe('2.70em');
    expect(lengthHeight(item(3), 0)).toBeUndefined();
    expect(lengthHeight(item(24, true), 1)).toBeUndefined();
  });
});

describe('readConfig: 1.1 settings', () => {
  it('carries the old Clock toggle over', () => {
    expect(readConfig({}).clock).toBe('show');
    expect(readConfig({ showClock: false }).clock).toBe('off');
    expect(readConfig({ showClock: false, clock: 'blank' }).clock).toBe('blank');
  });
  it('reads clock styling, end times and the now color', () => {
    const c = readConfig({ clockFont: 'caveat', clockWeight: '400', clockSize: '5', endTimes: 'all', nowColor: '#22d3ee' });
    expect(c.clockFont).toBe('caveat');
    expect(c.clockWeight).toBe(400);
    expect(c.clockSize).toBe(2);
    expect(c.endTimes).toBe('all');
    expect(c.nowColor).toBe('#22d3ee');
    expect(readConfig({}).endTimes).toBe('near');
  });
});

describe('lengthBarShare', () => {
  it('runs to the full width at 4 hours, with a sliver for short events and none for all-day', () => {
    expect(lengthBarShare(item(2))).toBe(0.5);
    expect(lengthBarShare(item(6))).toBe(1);
    expect(lengthBarShare(item(0.05))).toBe(0.04);
    expect(lengthBarShare(item(24, true))).toBeUndefined();
  });
});
