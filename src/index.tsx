import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle } from './host-style';
import { readConfig } from './config';
import type { Config } from './config';
import { addDays, eventsByDay, rollingDays, wallDate, weekday } from './dates';
import type { CalendarEvent } from './dates';
import { mergeEvents } from './merge';
import { chipColors } from './colors';
import { Chip, EventStack, Heading, MoreLine, OUTLINE, cardFrame, useElementSize } from './chip';
import type { Item } from './chip';
import { clockFormatter, countdown, ownerFinder, timeFormatter, useBoxSize, useEvents, usePeople } from './data';
import type { Person } from './data';

/** The now line, countdowns and which events have finished are re-read this often. */
const CLOCK_TICK_MS = 30_000;
/** Below this the text is no longer worth shrinking. */
const MIN_FONT_PX = 9;
/** The root text size on a 1920x1080 module; everything is in em from it. */
const BASE_FONT_PX = 30;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The three panels' sizes, in order of importance: today's text is the
 * largest, tomorrow's a step down, the rest of the days smaller again. The
 * widths give each panel room for its text, and two weeks give Coming up
 * more of the screen for its two columns of days.
 */
const PANELS = {
  week: { columns: '40fr 27fr 33fr', today: 1.45, tomorrow: 1.1, rest: 0.85 },
  twoWeeks: { columns: '35fr 24fr 41fr', today: 1.4, tomorrow: 1.05, rest: 0.78 },
};

const dayLabel = (day: string) => {
  const n = Number(day.slice(8));
  return { weekday: WEEKDAYS[weekday(day)], date: n === 1 ? `${MONTHS[Number(day.slice(5, 7)) - 1]} 1` : String(n) };
};

// ── Clock ───────────────────────────────────────────────────────────────────

/** The time, large, and the date under it. Ticks on its own each second, so
 *  the rest of the module doesn't re-render with it. */
function Clock({ format, config, fixedNow }: {
  format: ReturnType<typeof clockFormatter>;
  config: Config;
  fixedNow?: number;
}) {
  const [tick, setTick] = useState(() => fixedNow ?? Date.now());
  useEffect(() => {
    if (fixedNow !== undefined) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [fixedNow]);
  const c = format(fixedNow ?? tick);
  return (
    <div style={{ flexShrink: 0, lineHeight: 1, textShadow: config.textOutline ? OUTLINE : undefined, padding: '0 0.1em' }}>
      <div style={{ fontSize: '4.2em', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {c.time}
        {c.period && <span style={{ fontSize: '0.36em', fontWeight: 700, marginLeft: '0.25em', letterSpacing: 0 }}>{c.period}</span>}
      </div>
      <div style={{ fontSize: '1.3em', fontWeight: 700, marginTop: '0.2em', whiteSpace: 'nowrap', opacity: 0.95 }}>{c.date}</div>
    </div>
  );
}

// ── Agenda ──────────────────────────────────────────────────────────────────

/** The glowing line across today's list that says where in the day it is. */
function NowLine({ label, config }: { label: string; config: Config }) {
  const accent = config.accentColor;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3em', flexShrink: 0, margin: '0.05em 0' }}>
      <span style={{
        fontSize: '0.72em', fontWeight: 900, lineHeight: 1, whiteSpace: 'nowrap', padding: '0.14em 0.4em', borderRadius: '1em',
        background: accent, color: chipColors(accent).onBase, boxShadow: `0 0 0.5em ${accent}`,
      }}>{label}</span>
      <div style={{ flex: 1, height: '0.12em', borderRadius: '0.1em', background: accent, boxShadow: `0 0 0.4em ${accent}` }} />
    </div>
  );
}

const noteStyle = (config: Config, filled: boolean): CSSProperties => ({
  fontSize: '0.6em', fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', letterSpacing: '0.02em', alignSelf: 'flex-start',
  ...(filled
    ? { background: config.accentColor, color: chipColors(config.accentColor).onBase, borderRadius: '0.3em', padding: '0.1em 0.3em' }
    : { color: config.accentColor }),
});

/** Today's text may shrink this far before finished events fold away. */
const MIN_AGENDA_SCALE = 0.75;

/**
 * A day as a list, times lined up down the left. With `nowLine` (today):
 * finished events first, then the now line, then the event under way, marked
 * NOW, and the rest, the next one counting down. When it doesn't fit, the
 * text shrinks a little first, then the finished events fold into one
 * "3 earlier" line, then events drop off the end into "+2 more", so what's
 * still ahead stays as large as it can.
 */
function Agenda({ items, now, nowLine, config, time, resetKey, empty }: {
  items: Item[];
  now: number;
  nowLine: boolean;
  config: Config;
  time: (ms: number) => string;
  resetKey: string;
  empty: string;
}) {
  const allDay = items.filter((i) => i.allDay);
  const timed = items.filter((i) => !i.allDay);
  const done = nowLine ? timed.filter((i) => i.endMs <= now) : [];
  const ahead = nowLine ? timed.filter((i) => i.endMs > now) : timed;

  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);
  const key = `${resetKey}|${items.map((i) => i.event.id).join(',')}|${done.length}|${size}`;
  const [fit, setFit] = useState({ key: '', scale: 1, folded: false, shown: ahead.length });
  const scale = fit.key === key ? fit.scale : 1;
  const folded = fit.key === key ? fit.folded : false;
  const shown = fit.key === key ? fit.shown : ahead.length;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.clientHeight) return;
    const over = el.scrollHeight > el.clientHeight + 1;
    const state = { key, scale, folded, shown };
    if (over && scale > MIN_AGENDA_SCALE) setFit({ ...state, scale: Math.max(MIN_AGENDA_SCALE, scale * 0.92) });
    else if (over && !folded && done.length > 0) setFit({ ...state, folded: true });
    else if (over && shown > 0) setFit({ ...state, shown: shown - 1 });
    else if (fit.key !== key) setFit(state);
  });

  const nextUp = ahead.find((i) => i.startMs > now);
  const chip = (item: Item) => {
    // All-day events last all day, so marking them NOW would say nothing.
    const current = nowLine && !item.allDay && item.startMs <= now && item.endMs > now;
    let note: ReactNode = null;
    if (current) {
      note = (
        <>
          <span style={noteStyle(config, true)}>NOW</span>
          <span style={{ ...noteStyle(config, false), color: 'inherit', opacity: 0.85 }}>ends {time(item.endMs)}</span>
        </>
      );
    } else if (nowLine && item === nextUp) {
      const left = countdown(item.startMs - now);
      if (left) note = <span style={noteStyle(config, false)}>{left}</span>;
    }
    return (
      <Chip key={`${item.event.id}|${item.event.start}`} item={item} config={config} time={time} now={now}
        mode="agenda" note={note} current={current} />
    );
  };
  const hidden = ahead.length - shown;
  const showDone = config.pastStyle !== 'hide';

  return (
    <div ref={ref} style={{
      ['--lines' as string]: 3,
      fontSize: `${scale}em`, flex: 1, minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: '0.22em',
    }}>
      {allDay.map(chip)}
      {showDone && (folded
        ? done.length > 0 && (
          <div style={{ fontSize: '0.7em', fontWeight: 700, opacity: 0.75, flexShrink: 0, paddingLeft: '0.3em' }}>
            {`✓ ${done.length} earlier today`}
          </div>
        )
        : done.map(chip))}
      {nowLine && <NowLine label={time(now)} config={config} />}
      {ahead.slice(0, shown).map(chip)}
      {hidden > 0 && <MoreLine count={hidden} />}
      {ahead.length === 0 && (
        <div style={{ fontSize: '0.75em', fontWeight: 600, opacity: 0.75, flexShrink: 0, paddingLeft: '0.3em', textShadow: config.textOutline ? OUTLINE : undefined }}>
          {empty}
        </div>
      )}
    </div>
  );
}

// ── Panels ──────────────────────────────────────────────────────────────────

const panelPadding: CSSProperties = { padding: '0.45em 0.5em', gap: '0.35em' };

/** A day in Coming up: its name and date, then its events, time first. Busy
 *  days get the taller card. */
function ComingDay({ day, items, config, time, now, resetKey }: {
  day: string;
  items: Item[];
  config: Config;
  time: (ms: number) => string;
  now: number;
  resetKey: string;
}) {
  const label = dayLabel(day);
  return (
    <div style={{ ...cardFrame(config), padding: '0.35em 0.4em', gap: '0.25em', flex: `${items.length + 1.4} 1 0` }}>
      <Heading config={config}>
        <span style={{ fontSize: '0.72em', opacity: 0.85 }}>{label.weekday}</span>
        <span style={{ fontSize: '1.05em' }}>{label.date}</span>
      </Heading>
      <EventStack items={items} resetKey={resetKey} lines={config.titleLines}>
        {(item) => <Chip item={item} config={config} time={time} now={now} mode="inline" />}
      </EventStack>
    </div>
  );
}

// ── Module ──────────────────────────────────────────────────────────────────

export interface WallCalendarFullScreenProps extends PluginComponentProps {
  /** Preview and tests only: a fixed clock. */
  nowMs?: number;
}

export default function WallCalendarFullScreen(props: WallCalendarFullScreenProps) {
  const { style, timezone } = props;
  const config = useMemo(() => readConfig(props.config ?? {}), [props.config]);

  const [tick, setTick] = useState(() => props.nowMs ?? Date.now());
  useEffect(() => {
    if (props.nowMs !== undefined) return;
    const id = setInterval(() => setTick(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [props.nowMs]);
  const now = props.nowMs ?? tick;
  const today = wallDate(now, timezone);
  const tomorrow = addDays(today, 1);

  const days = useMemo(() => rollingDays(config.view, today), [config.view, today]);
  const { events, error } = useEvents(days, props.events as CalendarEvent[] | undefined);
  const people = usePeople(props.people as Person[] | undefined);
  const merged = useMemo(
    () => mergeEvents(events, ownerFinder(people, config), config.mergeDuplicates),
    [events, people, config],
  );
  const byDay = useMemo(() => eventsByDay(merged, days, config, timezone), [merged, days, config, timezone]);
  // "Hide" leaves finished events off everywhere but today, where they fold away instead.
  const itemsFor = (day: string) => (byDay.get(day) ?? [])
    .filter((item) => config.pastStyle !== 'hide' || day === today || item.endMs > now);
  const time = useMemo(() => timeFormatter(config, props.timeFormat, timezone), [config, props.timeFormat, timezone]);
  const clock = useMemo(() => clockFormatter(config, props.timeFormat, timezone), [config, props.timeFormat, timezone]);

  // Text grows with the module: 30px at 1920x1080 for the root, today's
  // events nearly half as large again. Text size and the module's Text size
  // slider scale it from there.
  const measureRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(measureRef);
  const fit = box.w > 0 && box.h > 0 ? Math.min(box.w / 1920, box.h / 1080) : 1;
  const textSize = (style.fontSize || 16) / 16;
  const fontPx = Math.max(MIN_FONT_PX, BASE_FONT_PX * fit * textSize * config.textScale);
  const resetKey = `${fontPx.toFixed(2)}|${config.view}|${config.titleLines}|${config.showTime}|${config.showLocation}|${config.showClock}`;

  const panels = PANELS[config.view];
  const rest = days.slice(2);
  const restColumns = config.view === 'twoWeeks' ? 2 : 1;
  const perColumn = Math.ceil(rest.length / restColumns);
  const tomorrowLabel = dayLabel(tomorrow);

  return (
    <div ref={measureRef} style={{ width: '100%', height: '100%' }}>
      <div lang="en" style={{
        ...hostFrameStyle(style), fontSize: fontPx,
        display: 'grid', gridTemplateColumns: panels.columns, gap: '0.5em',
      }}>
        {/* Today: the clock above the day's events, at the largest size. */}
        <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.45em' }}>
          {config.showClock && <Clock format={clock} config={config} fixedNow={props.nowMs} />}
          <div style={{ ...cardFrame(config), ...panelPadding, flex: 1, fontSize: `${panels.today}em` }}>
            <Heading config={config} color={config.accentColor}>
              <span style={{ fontSize: '0.75em' }}>Today</span>
            </Heading>
            <Agenda items={itemsFor(today)} now={now} nowLine config={config} time={time} resetKey={resetKey}
              empty={(byDay.get(today) ?? []).length ? 'Nothing else today' : 'Nothing on the calendar today'} />
          </div>
          {error && (
            <div style={{ fontSize: '0.6em', opacity: 0.8, flexShrink: 0 }}>Calendar unavailable: {error}</div>
          )}
        </div>

        {/* Tomorrow, a step smaller. */}
        <div style={{ ...cardFrame(config), ...panelPadding, fontSize: `${panels.tomorrow}em` }}>
          <Heading config={config}>
            <span style={{ fontSize: '0.75em' }}>Tomorrow</span>
            <span style={{ fontSize: '0.6em', opacity: 0.8 }}>{tomorrowLabel.weekday} {tomorrowLabel.date}</span>
          </Heading>
          <Agenda items={itemsFor(tomorrow)} now={now} nowLine={false} config={config} time={time} resetKey={resetKey}
            empty="Nothing scheduled" />
        </div>

        {/* The rest of the 7 or 14 days, smaller again, a card a day. */}
        <div style={{
          minWidth: 0, minHeight: 0, fontSize: `${panels.rest}em`,
          display: 'grid', gridTemplateColumns: `repeat(${restColumns}, minmax(0, 1fr))`, gap: '0.35em',
        }}>
          {Array.from({ length: restColumns }, (_, c) => (
            <div key={c} style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
              {rest.slice(c * perColumn, (c + 1) * perColumn).map((day) => (
                <ComingDay key={day} day={day} items={itemsFor(day)} config={config} time={time} now={now} resetKey={resetKey} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
