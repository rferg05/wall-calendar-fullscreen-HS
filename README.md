# Wall Calendar Full Screen

Home Screens module: a whole-screen calendar for the wall, in order of what matters now. A big clock and **today's** events come first and largest, with a glowing line marking where you are in the day; **tomorrow** a size down; then **the rest of the next 7 or 14 days**. Readable from across the room over any background photo.

A fork of [Wall Calendar](../wall-calendar/README.md): the same events, duplicate merging, shared-event colors, past-event graying and card styling, laid out for one screen instead of a grid.

## Install

In the Home Screens editor, open the Plugin Store, choose **Install from URL**, and paste:

```
https://github.com/rferg05/wall-calendar-fullscreen-HS/releases/latest/download/wall-calendar-fullscreen.tar.gz
```

This always points at the newest release. Home Screens doesn't check URL-installed plugins for updates on its own, so to update: Plugin Store > **Installed**, then the download icon on Wall Calendar Full Screen, then **Install**. Then add **Wall Calendar Full Screen** to a screen from the Calendar category and size it to fill the screen.

## What it shows

- **Clock:** the time, about 126 px tall on a 1080p screen, with the date under it. Its font (any of the host's: Caveat, Bebas Neue, Playfair Display...), weight, color and the time's and date's sizes are its own settings. Seconds are optional. *Leave the space empty* keeps the clock's exact spot clear, for a separate Clock module laid over it.
- **Today** (left, the largest text, about 44 px): all-day events first, then the day's events in time order with their times lined up down the left.
  - Each event shows when it starts and, under that, when it ends (*End times*, on for today and tomorrow by default).
  - A **length bar** runs along the bottom of each event in its color, as long as the event: a full-width bar is 4 hours or more, half-width 2 hours. Durations compare at a glance and take no room. *Size events by length* can also make longer events taller, on days with room.
  - Finished events sit above a **now line**: a glowing line with the current time on it, in the *Now color* (white by default, so it stands out from events in any calendar's color).
  - The event **under way** is ringed in the now color and marked **NOW**.
  - The **next** event counts down: *in 25 min*, *in 1h 20m*, *in 3h*.
  - When today has more than fits, the text shrinks a little first, then the finished events fold into one *✓ 3 earlier today* line, then later events drop into *+2 more*. What's still ahead stays as large as it can.
- **Tomorrow** (middle, about 33 px): the same list, without the now line.
- **Coming up** (right, about 25 px): a card for each remaining day, events with their time first. Busy days get the taller cards. With 14 days, two columns of cards.
- **Days** are rolling: always today and the 6 (or 13) after it, so on a Friday you still see through next Thursday.

Everything else works as in Wall Calendar: events colored by calendar or person, near-duplicates merged ("Reservation at Avec" and "Reservation: Avec"), events on two people's calendars bookended in both colors, the calendar filter's `~` dropped, finished events grayed out, and holidays in a color of their own if you like.

## Looks

The module is meant to let the background photo show through.

- **Cards:** each panel and day is a card, styled under *Day cards* like the Style panel styles a module: background color and strength (55% by default; 15–25% leaves the photo clearly visible), a frosted-glass blur, and a border.
- **Dividers:** a rule under Today, Tomorrow and each day's name, in a color and thickness you pick. They're part of the module, so separate Shape & Divider modules aren't needed (and their editor labels no longer cover the day names).
- **Legibility over the photo:** the clock and headings keep a fine dark outline, and every event sits on its own solid chip, so even at a very low card strength the text holds up over a bright or busy photo.
- **Long words** hyphenate at the end of a line ("Appoint-ment") instead of breaking anywhere.

## Sizing

Text sizes come from the module's size: the root is 30 px on a 1920×1080 module and scales with the smaller of its width and height against that. *Text size* in the settings, and the Style panel's Text size, scale it from there. The module is designed to fill the screen; at half the screen everything is half as large.

## Settings

| Setting | Default | |
|---|---|---|
| Show | 7 days | Or 14, from today. |
| Clock | Show | Or leave the space empty (for a Clock module), or off. |
| Clock: Font / Weight / Color | module's / Heavy / white | Any of the host's fonts. |
| Clock: Time size / Date / Date size / Seconds | 1× / on / 1× / off | |
| Start times / Location | on / on | Location under the title, today and tomorrow. |
| End times | Today and tomorrow | Or off, or everywhere ("5:30–7p"). |
| Length bars | on | Today and tomorrow. Full width is 4 hours. |
| Size events by length | off | Today and tomorrow, about 1.8 lines an hour up to 4 hours. Eases off on crowded days. |
| Lines per title in Coming up | 2 | How short a busy day in Coming up may cut titles. Today and tomorrow show up to 3. |
| Color events by | Calendar color | Or person, from Settings > Family. |
| Merge duplicate events | on | |
| Events you share | Both colors | Or one color of their own. |
| Event style | Dark with a color bar | Or filled. All-day events are always filled. |
| Past events | Gray out | Or fade, hide, or leave as is. |
| Holidays / Own color for holidays / Birthdays | on / off / on | |
| Hide events whose title contains | | Comma-separated. |
| Day cards: Background color / strength | near-black / 55% | |
| Day cards: Frosted glass / Border | off / off | |
| Dividers under headings | on, light gray, 2 px | |
| Text size | 1× | 0.5–2×. |
| Outline the clock and headings | on | |
| Accent color | amber | Today's heading. |
| Now color | white | The now line, NOW, the ring on the event under way and the countdown. |
| Clock times | Household setting | Or 12-hour (7p, 7:30p) or 24-hour. |

## Development

```bash
npm install
npm test             # rolling days, household midnight, merging, countdowns, the clock
npm run preview      # module against a mock calendar at http://localhost:5179
npm run build        # dist/bundle.js
```

The preview takes `?w=&h=` for the module size (1920×1080 by default), `fs=` for text size, `bg=night|bright|busy|dark` for the background, `tz=`, and any config key (`view=twoWeeks`, `dayBackdrop=15`). Today's sample events are placed around the current time, so the now line, NOW and the countdown always show.

Release tarball:

```bash
mkdir -p release/pkg/wall-calendar-fullscreen/dist
cp manifest.json release/pkg/wall-calendar-fullscreen/
cp dist/bundle.js dist/bundle.js.map release/pkg/wall-calendar-fullscreen/dist/
tar -czf release/wall-calendar-fullscreen-<version>.tar.gz -C release/pkg wall-calendar-fullscreen
```

Attach it to a GitHub release tagged `v<version>`, along with a copy named `wall-calendar-fullscreen.tar.gz` so the `latest/download` URL above keeps working:

```bash
cp release/wall-calendar-fullscreen-<version>.tar.gz release/wall-calendar-fullscreen.tar.gz
gh release create v<version> release/wall-calendar-fullscreen-<version>.tar.gz release/wall-calendar-fullscreen.tar.gz --title v<version>
```
