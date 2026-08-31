# Napkin

A lifting log that fits on a napkin. Personal PWA for the Weekday Split program
(Upper/Lower, Mon/Tue/Thu/Fri).

- **Lift** — pick a session, weights prefilled from last time, ± steppers, per-set reps.
  Cards turn green when every set hits the top of the rep range.
- **Body** — bodyweight, waist, 7-day rolling average.
- **Progress** — per-exercise history and trend line.
- **Backup** — JSON/CSV export via the iOS share sheet, JSON restore.

Data lives in `localStorage` on the device. No accounts, no server, no tracking.

## Progression

Double progression: hit the top of the rep range on all sets → add weight
(+2.5 kg barbell, next dumbbell up, +5 kg machine). Miss the bottom of the range
twice at the same weight → drop 10 %.

Main lifts stop 1–2 reps short of failure; the last set of accessory work goes to failure.

## Run locally

    python3 -m http.server 8000

Then open http://localhost:8000.

## Tests

    node logic.test.mjs

`logic.js` holds all the program and progression rules and has no DOM dependencies.
