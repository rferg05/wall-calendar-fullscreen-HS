// Module config, read defensively: the editor stores whatever its widgets
// produce, so numbers can arrive as strings and old configs miss new keys.

/** Days on screen, counting from today: a rolling 7 or 14. */
export type View = 'week' | 'twoWeeks';

export interface Config {
  view: View;
  /** The clock above today: drawn, an empty space of its size (to lay a
   *  separate Clock module over), or nothing, giving today the room. */
  clock: 'show' | 'blank' | 'off';
  clockSeconds: boolean;
  showDate: boolean;
  /** A font id from the host's registry ("inter", "caveat"...), or '' for the module's own. */
  clockFont: string;
  clockWeight: number;
  clockColor: string;
  /** Multiply the clock's and the date's default sizes. */
  clockSize: number;
  dateSize: number;
  showTime: boolean;
  /** Where events show when they end as well as start ("5:30–7p"). */
  endTimes: 'off' | 'near' | 'all';
  /** Today's and tomorrow's events grow taller the longer they last. */
  sizeByLength: boolean;
  /** Today's and tomorrow's events carry a bar as long as they are. */
  lengthBars: boolean;
  /** Under the title, for today and tomorrow. */
  showLocation: boolean;
  /** Lines a title may be cut to on a busy day in Coming up. */
  titleLines: number;
  colorBy: 'calendar' | 'person';
  /** Merge near-duplicates (same time, near-same title), not just exact copies. */
  mergeDuplicates: boolean;
  /** An event on more than one person's calendar: both colors, or one color of its own. */
  sharedStyle: 'split' | 'color';
  sharedColor: string;
  chipStyle: 'tinted' | 'solid';
  /** Events that have ended: drained of color, faded, left off, or as is. */
  pastStyle: 'gray' | 'fade' | 'hide' | 'none';
  showHolidays: boolean;
  /** Draw holidays in `holidayColor` instead of the holiday calendar's color. */
  customHolidayColor: boolean;
  holidayColor: string;
  showBirthdays: boolean;
  /** Lowercased words; events whose title contains one are hidden. */
  hideWords: string[];
  /** Multiplies the size worked out from the module's size. */
  textScale: number;
  /** Each panel's card: its color, how strongly it's laid over the photo
   *  (0-100), frosted-glass blur (px), and border. */
  dayBackground: string;
  dayBackdrop: number;
  dayBlur: number;
  dayBorderWidth: number;
  dayBorderColor: string;
  /** A rule under each panel's and day's heading. */
  showDividers: boolean;
  dividerColor: string;
  dividerWidth: number;
  textOutline: boolean;
  accentColor: string;
  /** The now line, NOW, the ring on the event under way and the countdown:
   *  its own color, so it stands out from events in the accent's hue. */
  nowColor: string;
  timeFormat: 'auto' | '12h' | '24h';
}

export const DEFAULTS: Config = {
  view: 'week',
  clock: 'show',
  clockSeconds: false,
  showDate: true,
  clockFont: '',
  clockWeight: 800,
  clockColor: '#ffffff',
  clockSize: 1,
  dateSize: 1,
  showTime: true,
  endTimes: 'near',
  sizeByLength: false,
  lengthBars: true,
  showLocation: true,
  titleLines: 2,
  colorBy: 'calendar',
  mergeDuplicates: true,
  sharedStyle: 'split',
  sharedColor: '#a855f7',
  chipStyle: 'tinted',
  pastStyle: 'gray',
  showHolidays: true,
  customHolidayColor: false,
  holidayColor: '#ef4444',
  showBirthdays: true,
  hideWords: [],
  textScale: 1,
  dayBackground: '#080a0e',
  dayBackdrop: 55,
  dayBlur: 0,
  dayBorderWidth: 0,
  dayBorderColor: '#64748b',
  showDividers: true,
  dividerColor: '#cbd5e1',
  dividerWidth: 2,
  textOutline: true,
  accentColor: '#f59e0b',
  nowColor: '#ffffff',
  timeFormat: 'auto',
};

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && value !== '' && value !== null ? Math.min(max, Math.max(min, n)) : fallback;
}

const color = (value: unknown, fallback: string): string =>
  (typeof value === 'string' && value.trim() ? value.trim() : fallback);

export function readConfig(raw: Record<string, unknown>): Config {
  const words = typeof raw.hideWords === 'string' ? raw.hideWords : '';
  return {
    view: oneOf(raw.view, ['week', 'twoWeeks'] as const, DEFAULTS.view),
    // 1.0 had a Clock on/off toggle; off still means off.
    clock: oneOf(raw.clock, ['show', 'blank', 'off'] as const, bool(raw.showClock, true) ? DEFAULTS.clock : 'off'),
    clockSeconds: bool(raw.clockSeconds, DEFAULTS.clockSeconds),
    showDate: bool(raw.showDate, DEFAULTS.showDate),
    clockFont: typeof raw.clockFont === 'string' ? raw.clockFont.trim() : DEFAULTS.clockFont,
    clockWeight: Math.round(num(raw.clockWeight, DEFAULTS.clockWeight, 100, 900) / 100) * 100,
    clockColor: color(raw.clockColor, DEFAULTS.clockColor),
    clockSize: num(raw.clockSize, DEFAULTS.clockSize, 0.4, 2),
    dateSize: num(raw.dateSize, DEFAULTS.dateSize, 0.4, 2),
    showTime: bool(raw.showTime, DEFAULTS.showTime),
    endTimes: oneOf(raw.endTimes, ['off', 'near', 'all'] as const, DEFAULTS.endTimes),
    sizeByLength: bool(raw.sizeByLength, DEFAULTS.sizeByLength),
    lengthBars: bool(raw.lengthBars, DEFAULTS.lengthBars),
    showLocation: bool(raw.showLocation, DEFAULTS.showLocation),
    titleLines: Math.round(num(raw.titleLines, DEFAULTS.titleLines, 1, 4)),
    colorBy: oneOf(raw.colorBy, ['calendar', 'person'] as const, DEFAULTS.colorBy),
    mergeDuplicates: bool(raw.mergeDuplicates, DEFAULTS.mergeDuplicates),
    sharedStyle: oneOf(raw.sharedStyle, ['split', 'color'] as const, DEFAULTS.sharedStyle),
    sharedColor: color(raw.sharedColor, DEFAULTS.sharedColor),
    chipStyle: oneOf(raw.chipStyle, ['tinted', 'solid'] as const, DEFAULTS.chipStyle),
    pastStyle: oneOf(raw.pastStyle, ['gray', 'fade', 'hide', 'none'] as const, DEFAULTS.pastStyle),
    showHolidays: bool(raw.showHolidays, DEFAULTS.showHolidays),
    customHolidayColor: bool(raw.customHolidayColor, DEFAULTS.customHolidayColor),
    holidayColor: color(raw.holidayColor, DEFAULTS.holidayColor),
    showBirthdays: bool(raw.showBirthdays, DEFAULTS.showBirthdays),
    hideWords: words.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean),
    textScale: num(raw.textScale, DEFAULTS.textScale, 0.5, 2),
    dayBackground: color(raw.dayBackground, DEFAULTS.dayBackground),
    dayBackdrop: num(raw.dayBackdrop, DEFAULTS.dayBackdrop, 0, 100),
    dayBlur: num(raw.dayBlur, DEFAULTS.dayBlur, 0, 30),
    dayBorderWidth: num(raw.dayBorderWidth, DEFAULTS.dayBorderWidth, 0, 8),
    dayBorderColor: color(raw.dayBorderColor, DEFAULTS.dayBorderColor),
    showDividers: bool(raw.showDividers, DEFAULTS.showDividers),
    dividerColor: color(raw.dividerColor, DEFAULTS.dividerColor),
    dividerWidth: num(raw.dividerWidth, DEFAULTS.dividerWidth, 1, 6),
    textOutline: bool(raw.textOutline, DEFAULTS.textOutline),
    accentColor: color(raw.accentColor, DEFAULTS.accentColor),
    nowColor: color(raw.nowColor, DEFAULTS.nowColor),
    timeFormat: oneOf(raw.timeFormat, ['auto', '12h', '24h'] as const, DEFAULTS.timeFormat),
  };
}
