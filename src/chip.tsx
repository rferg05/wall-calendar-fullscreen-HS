// How an event and a panel look: the event chip (shared with Wall Calendar),
// the stack that fits a day's events into its card, and the card itself.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Config } from './config';
import type { DayEvent } from './dates';
import { chipColors } from './colors';
import { colorWithAlpha } from './host-style';
import { isShared } from './merge';
import type { MergedEvent } from './merge';

/** A day's event, after duplicates are merged. */
export type Item = DayEvent<MergedEvent>;

/** A dark ring and soft glow around light text, so headings, the clock and
 *  dates read over a bright photo where the card behind them is thin. */
export const OUTLINE = '0 0 0.08em rgba(0,0,0,0.95), 0 0 0.08em rgba(0,0,0,0.95), 0 0.04em 0.25em rgba(0,0,0,0.7)';

/** Title lines come from the `--lines` the enclosing stack sets, so a quiet
 *  day can show whole titles and a busy one can cut them short. Long words
 *  hyphenate ("Appoint-ment") rather than breaking anywhere. */
const clampedTitle: CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 'var(--lines, 3)' as unknown as number, WebkitBoxOrient: 'vertical',
  overflow: 'hidden', overflowWrap: 'break-word', hyphens: 'auto',
};

/** A finished event with "Gray out": a flat gray chip with light gray text,
 *  keeping a dimmed bar of its color so whose it was still shows. */
const PAST_SURFACE = 'rgba(46, 50, 58, 0.92)';
const PAST_INK = '#c3c9d2';

/** The chip's colors: its owner's, or for a shared event each owner's (or
 *  the one "together" color). */
function chipPalette(event: MergedEvent, config: Config) {
  if (!isShared(event)) return [chipColors(event.ownerColors[0])];
  if (config.sharedStyle === 'color') return [chipColors(config.sharedColor)];
  return [...new Set(event.ownerColors)].map((c) => chipColors(c));
}

export interface ChipProps {
  item: Item;
  config: Config;
  time: (ms: number) => string;
  now: number;
  /**
   * Where the time goes: above the title (`stack`), before it on the same
   * line (`inline`), or in a column of its own down the left (`agenda`),
   * which lines the times up and leaves room under each for `note`.
   */
  mode: 'stack' | 'inline' | 'agenda';
  /** Agenda only: under the time, e.g. "NOW" or "in 25 min". */
  note?: ReactNode;
  /** Under way: ringed in the now color. */
  current?: boolean;
  /** Show when it ends as well as when it starts. */
  endTime?: boolean;
  /** Length sizing: at least this tall, so a longer event is a taller chip. */
  minHeight?: string;
  /** The length bar: a rule along the bottom edge in the event's color, this
   *  share (0-1) of the chip's width. */
  lengthBar?: number;
  /** Under way: how far through it is (0-1). The now line crosses the chip
   *  that far down, so where you are in the event shows at a glance. */
  progress?: number;
}

/** A length bar spans the chip at this many hours. */
export const LENGTH_BAR_FULL_HOURS = 4;

/** The length bar's share of the chip for an event, or undefined for none
 *  (all-day events run all day; the bar would say nothing). */
export function lengthBarShare(item: { allDay: boolean; startMs: number; endMs: number }): number | undefined {
  if (item.allDay) return undefined;
  const hours = Math.max(0, item.endMs - item.startMs) / 3_600_000;
  return Math.min(1, Math.max(0.04, hours / LENGTH_BAR_FULL_HOURS));
}

/** "5:30–7p": a range in the times' own format, the first time's am/pm left
 *  off when both share it. */
export function timeRange(start: string, end: string): string {
  const a = /([ap])$/.exec(start);
  const b = /([ap])$/.exec(end);
  return `${a && b && a[1] === b[1] ? start.slice(0, -1) : start}–${end}`;
}

/** One event. All-day events are filled with their color, timed ones (by
 *  default) a dark chip in their hue with a bar of it, so the two read apart
 *  at a glance. White text on either stays legible over any background.
 *
 *  An event shared by two people, with "Both colors" on, is bookended: one
 *  person's color down the left edge and the other's down the right, over a
 *  surface blending one's tint into the other's. Filled, it runs from one
 *  color to the other. Nothing else on the calendar has a bar on its right
 *  edge, so "ours" reads from across the room without names. */
export function Chip({ item, config, time, now, mode, note, current, endTime, minHeight, lengthBar, progress }: ChipProps) {
  const { event, allDay } = item;
  const palette = chipPalette(event, config);
  const colors = palette[0];
  const both = palette.length > 1;
  const finished = item.endMs <= now;
  const grayed = finished && config.pastStyle === 'gray';
  const faded = finished && config.pastStyle === 'fade';
  // A grayed chip is never filled, so its color only survives in the bars.
  const solid = (allDay || config.chipStyle === 'solid') && !grayed;
  // On a two-color fill, white with a shadow unless both colors want dark text.
  const ink = grayed ? PAST_INK
    : !solid ? '#ffffff' : both && palette.some((p) => p.onBase !== colors.onBase) ? '#ffffff' : colors.onBase;
  const blend = (key: 'base' | 'surface') => (both
    ? `linear-gradient(90deg, ${palette.map((p, i) => `${p[key]} ${Math.round((i / (palette.length - 1)) * 100)}%`).join(', ')})`
    : colors[key]);
  const barWidth = mode === 'agenda' ? '0.2em' : both ? '0.32em' : '0.26em';
  const bar = (color: string) => (
    <div style={{ width: barWidth, flexShrink: 0, background: color, opacity: grayed ? 0.5 : 1 }} />
  );
  // The start; with `endTime`, the end too, even when that's after midnight.
  // A later day of a multi-day event says when it ends.
  let when = '';
  let until = '';
  if (config.showTime && !allDay) {
    if (item.first) {
      when = time(item.startMs);
      if (endTime) until = time(item.endMs);
    } else if (item.last) when = `→${time(item.endMs)}`;
  }
  if (mode === 'agenda' && allDay) when = 'All day';
  const range = until ? timeRange(when, until) : when;
  const title = `${event.icon ? `${event.icon} ` : ''}${event.title?.trim() || '(No title)'}`;
  const location = config.showLocation && mode !== 'inline' && event.location ? event.location.split(',')[0].trim() : '';
  const shadows = [
    grayed ? '' : '0 0.05em 0.2em rgba(0,0,0,0.45)',
    current ? `inset 0 0 0 0.09em ${config.nowColor}` : '',
  ].filter(Boolean).join(', ');

  return (
    <div style={{
      display: 'flex', minWidth: 0, maxWidth: '100%', flexShrink: 0, borderRadius: '0.3em', overflow: 'hidden', minHeight,
      position: 'relative', paddingBottom: lengthBar !== undefined ? '0.14em' : undefined,
      background: grayed ? PAST_SURFACE : blend(solid ? 'base' : 'surface'), color: ink, opacity: faded ? 0.5 : 1,
      boxShadow: shadows || undefined,
      textShadow: solid && both && ink === '#ffffff' ? '0 0 0.15em rgba(0,0,0,0.75)' : undefined,
    }}>
      {!solid && bar(colors.base)}
      {mode === 'agenda' && (
        <div style={{
          width: '3.3em', flexShrink: 0, padding: '0.16em 0 0.16em 0.4em', lineHeight: 1.1,
          display: 'flex', flexDirection: 'column', gap: '0.12em',
        }}>
          <span style={{ fontSize: '0.82em', fontWeight: 800, whiteSpace: 'nowrap' }}>{when}</span>
          {until && (
            <span style={{ fontSize: '0.62em', fontWeight: 700, whiteSpace: 'nowrap', opacity: 0.85 }}>{`–${until}`}</span>
          )}
          {note}
        </div>
      )}
      <div style={{
        minWidth: 0, flex: both || mode === 'agenda' ? 1 : undefined,
        padding: mode === 'agenda' ? '0.12em 0.4em 0.16em 0.2em' : '0.14em 0.34em 0.16em', lineHeight: 1.15,
      }}>
        {when && mode === 'stack' && (
          <div style={{ fontSize: '0.78em', fontWeight: 800, whiteSpace: 'nowrap', opacity: 0.95 }}>{range}</div>
        )}
        <div style={{ ...clampedTitle, fontWeight: 700 }}>
          {when && mode === 'inline' && <span style={{ fontWeight: 800, opacity: 0.9, marginRight: '0.3em' }}>{range}</span>}
          {title}
        </div>
        {location && (
          <div style={{ fontSize: '0.7em', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.85 }}>
            {location}
          </div>
        )}
      </div>
      {!solid && both && (
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {palette.slice(1).map((p, i) => (
            <div key={i} style={{ flex: 1, width: barWidth, background: p.base, opacity: grayed ? 0.5 : 1 }} />
          ))}
        </div>
      )}
      {progress !== undefined && <ProgressLine progress={progress} color={config.nowColor} />}
      {lengthBar !== undefined && (
        <div style={{
          position: 'absolute', left: 0, bottom: 0, height: '0.18em', width: `${(lengthBar * 100).toFixed(1)}%`,
          background: blend('base'), opacity: grayed ? 0.5 : 1, borderTopRightRadius: '0.1em',
        }} />
      )}
    </div>
  );
}

/** The now line where it crosses the event under way: a glowing rule from
 *  edge to edge with a dot at the start, `progress` of the way down. A thin
 *  dark edge keeps it apart from white text it passes through. */
function ProgressLine({ progress, color }: { progress: number; color: string }) {
  const top = `${(Math.min(1, Math.max(0, progress)) * 100).toFixed(1)}%`;
  return (
    <>
      <div style={{
        position: 'absolute', left: 0, right: 0, top, height: '0.09em', transform: 'translateY(-50%)', zIndex: 1,
        background: color, boxShadow: `0 0 0.3em ${color}, 0 0 0 0.03em rgba(0, 0, 0, 0.55)`, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: '0.08em', top, width: '0.34em', height: '0.34em', borderRadius: '50%', zIndex: 1,
        transform: 'translateY(-50%)', background: color, boxShadow: `0 0 0.35em ${color}`, pointerEvents: 'none',
      }} />
    </>
  );
}

/** A busy day's text may shrink this far before events are left off. */
const MIN_STACK_SCALE = 0.72;
/** Lines a title may use on a day with room to spare. */
const ROOMY_LINES = 6;

/**
 * A day's events, as many as fit, then "+N more". A day with room shows
 * whole titles. A busy one first cuts titles a line at a time down to
 * `lines`, then shrinks its own text a step at a time (never below
 * MIN_STACK_SCALE), then drops one event at a time until the stack fits its
 * card. Measured before paint, so an overflowing frame never shows. Starts
 * over whenever the events, the text size or the card's size change.
 */
export function EventStack({ items, resetKey, lines, children }: {
  items: Item[];
  resetKey: string;
  /** Title lines on a busy day. */
  lines: number;
  children: (item: Item) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const roomy = Math.max(lines, ROOMY_LINES);
  const [fit, setFit] = useState({ key: '', shown: items.length, scale: 1, lines: roomy });
  const size = useElementSize(ref);
  const key = `${resetKey}|${items.map((i) => i.event.id).join(',')}|${size}`;
  const shown = fit.key === key ? fit.shown : items.length;
  const scale = fit.key === key ? fit.scale : 1;
  const titleLines = fit.key === key ? fit.lines : roomy;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.clientHeight) return;
    const over = el.scrollHeight > el.clientHeight + 1;
    const state = { key, shown, scale, lines: titleLines };
    if (over && titleLines > lines) setFit({ ...state, lines: titleLines - 1 });
    else if (over && scale > MIN_STACK_SCALE) setFit({ ...state, scale: Math.max(MIN_STACK_SCALE, scale * 0.9) });
    else if (over && shown > 0) setFit({ ...state, shown: shown - 1 });
    else if (fit.key !== key) setFit(state);
  });

  const hidden = items.length - shown;
  return (
    <div ref={ref} style={{
      ['--lines' as string]: titleLines,
      fontSize: `${scale}em`, flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex',
      flexDirection: 'column', gap: '0.2em',
    }}>
      {items.slice(0, shown).map((item) => (
        <React.Fragment key={`${item.event.id}|${item.event.start}`}>{children(item)}</React.Fragment>
      ))}
      {hidden > 0 && <MoreLine count={hidden} />}
    </div>
  );
}

export function MoreLine({ count }: { count: number }) {
  return (
    <div style={{ fontSize: '0.8em', fontWeight: 800, lineHeight: 1.05, whiteSpace: 'nowrap', padding: '0 0.2em', flexShrink: 0 }}>
      +{count} more
    </div>
  );
}

/** An element's size as a string, for keys that must change when it does. */
export function useElementSize(ref: React.RefObject<HTMLDivElement | null>): string {
  const [size, setSize] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(`${el.clientWidth}x${el.clientHeight}`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * A panel's or day's card, styled from the Cards settings the way the host
 * styles a module: a background color laid over the photo at a chosen
 * strength, an optional frosted-glass blur of what's behind it, and an
 * optional border. A card never takes `opacity` itself: with the blur on,
 * that hides the blur entirely (see host-style.ts).
 */
export function cardFrame(config: Config): CSSProperties {
  const strength = config.dayBackdrop / 100;
  const background = colorWithAlpha(config.dayBackground, strength) ?? `rgba(8, 10, 14, ${strength})`;
  const blur = config.dayBlur > 0 ? `blur(${config.dayBlur}px)` : undefined;
  return {
    minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: '0.4em', boxSizing: 'border-box',
    background,
    border: config.dayBorderWidth > 0 ? `${config.dayBorderWidth}px solid ${config.dayBorderColor}` : undefined,
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
  };
}

/** A heading with the optional rule under it: TODAY, TOMORROW, SUN 25. */
export function Heading({ config, children, color }: { config: Config; children: ReactNode; color?: string }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.18em' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '0.4em', lineHeight: 1, fontWeight: 800,
        letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden',
        color, textShadow: config.textOutline ? OUTLINE : undefined,
      }}>
        {children}
      </div>
      {config.showDividers && (
        <div style={{
          height: config.dividerWidth, borderRadius: config.dividerWidth, background: config.dividerColor, opacity: 0.75,
          boxShadow: config.textOutline ? '0 0 0.15em rgba(0,0,0,0.6)' : undefined,
        }} />
      )}
    </div>
  );
}
