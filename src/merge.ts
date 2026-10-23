// One event per thing that's happening, however many calendars it's on.
//
// With more than one calendar linked, the same event turns up more than once:
// the same invite on two people's calendars, or a reservation that both the
// booking site and Gmail added, titled "Reservation at Avec" by one and
// "Reservation: Avec" by the other. Events starting at about the same time
// with about the same title are merged, and the merged event remembers whose
// calendars it came from, so an event two people share can be drawn as theirs
// together.

import type { CalendarEvent } from './dates';
import { isAllDay } from './dates';

/** A merged event: the shown copy, plus everyone it belongs to. */
export interface MergedEvent extends CalendarEvent {
  /** Owner keys (see `ownerOf`), one per person or unlinked calendar, in first-seen order. */
  owners: string[];
  /** Each owner's color, matching `owners`. */
  ownerColors: string[];
}

/** Starts this close together can be the same event. */
const SAME_START_MS = 15 * 60_000;
/** Share of the shorter title's words the longer one must also have. */
const MIN_OVERLAP = 0.8;

/** Words too common to tell two titles apart: "Reservation at Avec" and
 *  "Reservation: Avec" are the same once "at" is gone. */
const FILLER = new Set(['a', 'an', 'the', 'at', 'for', 'with', 'and', 'of', 'on', 'in', 'to', 'by', 'w']);

/**
 * The title to show: without the "~" that marks an Outlook event as personal
 * for the calendar filter (see Calendar Filter/README.md). The filter strips
 * it from its own feed, but the same event reaches other calendars, through
 * an invite or a shared calendar, with the "~" still on.
 */
export function cleanTitle(title: string | undefined): string {
  return (title ?? '').replace(/^\s*~+\s*/, '').replace(/\s*~+\s*$/, '').trim();
}

export function titleWords(title: string | undefined): string[] {
  return cleanTitle(title)
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !FILLER.has(w));
}

/** Same title, near enough: every word of the shorter one (bar 1 in 5) is
 *  in the longer one. "Soccer practice" and "Soccer game" are different. */
export function similarTitles(a: string | undefined, b: string | undefined): boolean {
  const wa = new Set(titleWords(a));
  const wb = new Set(titleWords(b));
  if (wa.size === 0 || wb.size === 0) return cleanTitle(a).toLowerCase() === cleanTitle(b).toLowerCase();
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) >= MIN_OVERLAP;
}

/** Both all-day on the same first day, or both timed and starting within 15 minutes. */
function sameSlot(a: CalendarEvent, b: CalendarEvent): boolean {
  const allDay = isAllDay(a);
  if (allDay !== isAllDay(b)) return false;
  if (allDay) return a.start.slice(0, 10) === b.start.slice(0, 10);
  const sa = Date.parse(a.start);
  const sb = Date.parse(b.start);
  return Number.isFinite(sa) && Number.isFinite(sb) && Math.abs(sa - sb) <= SAME_START_MS;
}

/** The title with the most to say; on a tie the shorter one, which fits better. */
function betterTitle(a: string, b: string): string {
  const [na, nb] = [titleWords(a).length, titleWords(b).length];
  if (na !== nb) return na > nb ? a : b;
  return b.length < a.length ? b : a;
}

export interface Owner {
  /** One per person, or per calendar that no one is linked to. */
  key: string;
  color: string;
}

/**
 * Merge duplicates. `ownerOf` says whose an event is; two copies with the
 * same owner (one person's two calendars) are merged too, but only copies
 * from different owners make an event shared. With `merge` off, only exact
 * copies (same title and times) are merged, as before.
 */
export function mergeEvents(
  events: CalendarEvent[] | undefined,
  ownerOf: (ev: CalendarEvent) => Owner,
  merge = true,
): MergedEvent[] {
  if (!Array.isArray(events)) return [];
  const out: MergedEvent[] = [];
  const sorted = events
    .filter((e) => e && typeof e.start === 'string')
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start));
  for (const ev of sorted) {
    const title = cleanTitle(ev.title);
    const owner = ownerOf(ev);
    const match = out.find((m) => (merge
      ? sameSlot(m, ev) && similarTitles(m.title, title)
      : m.start === ev.start && m.end === ev.end && m.title.toLowerCase() === title.toLowerCase()));
    if (!match) {
      out.push({ ...ev, title, owners: [owner.key], ownerColors: [owner.color] });
      continue;
    }
    match.title = betterTitle(match.title, title);
    if (Date.parse(ev.end) > Date.parse(match.end)) match.end = ev.end;
    if (!match.location && ev.location) match.location = ev.location;
    if (!match.owners.includes(owner.key)) {
      match.owners.push(owner.key);
      match.ownerColors.push(owner.color);
    }
  }
  return out;
}

/** Shared by more than one person (or unlinked calendar). */
export const isShared = (ev: CalendarEvent): boolean =>
  Array.isArray((ev as MergedEvent).owners) && (ev as MergedEvent).owners.length > 1;
