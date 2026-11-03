# Release Notes

## 3.3.0 (2026-11-03)

### Capture into a note other than the daily note

Until now, everything you captured landed in the daily note: quick add,
quick-add links and "Capture today" all wrote there. Fine for mood or sleep.
Less so for data that belongs to a session.

Here's my own case. I do small exercises through the day: push-ups, planks,
squats. I want them in one strength session note per day
(`2026-11-03 (Strength Session)`, with `workout_kind: Through the day`), in the
same folder as the gym sessions Garmin syncs for me. Those gym sessions must
never receive the push-ups.

This release adds **capture targets** for that.

- New page: **Settings → Life Tracker → Capture targets**. A target is a note
  type (an Obsidian Starter Kit note type, or a folder and file name), a match
  filter such as `workout_kind` = `Through the day`, an optional template and a
  date property (`date` by default).
- Each property gets a **Capture into** setting: automatic, the daily note, or
  a capture target. Automatic sends a property imported from a Starter Kit note
  type to the target of that note type.
- The plugin finds the day's note by its type, its match filter and its date
  property. Another note of the same type on the same day (my Garmin session)
  is never used.
- No note yet? With **Create missing notes when capturing** on, the plugin asks
  first, then creates it from its template. If the file name is taken, it picks
  the next free one (`2026-11-03 2 (Strength Session)`). It then writes the
  date, the match filter values and the tags, even without Templater. The
  note is dated by its date property, so you don't get the "will not appear in
  your views" warning for it.
- "Capture today" now lists only the properties that go to the daily note.

No capture targets? Then nothing changes for you.

### One command per target, ready for a button

Each target adds its own command: **Capture today: \<target name\>**. The
target's settings show the command id, `life-tracker:capture-today-target-<id>`,
so you can run it from a button, a hotkey or any plugin that runs commands.
Renaming the target keeps the id, so your button keeps working.

In my vault, a Meta Bind button in my daily note template, **💪 Small
exercises**, runs that command. One tap opens the capture dialog on today's
"Through the day" note, and offers to create the note first when it doesn't
exist yet.

### Quick add, grouped by note

- The quick-add panel now groups its rows by note: the daily note, then each
  capture target. Each group has its own **Full capture** button, and a
  **Create note** button when its note doesn't exist yet (with **Create missing
  notes when capturing** on). With only the daily note, the panel looks exactly
  like before.
- Quick-add links write into the note of the property's capture target. Your
  links don't change: once push-ups go to a target, the same push-ups link
  writes there.
- New link action `append=<value>`: adds one entry to a list (or tags)
  property. For example, `append=12@60` logs a set of 12 reps at 60 kg.

### Goals: "Days with a value"

A new measure for goals: the number of days with at least one non-zero value.
Two notes on the same day count as one day, so a "3 days a week" goal stays
right when a gym session and a "Through the day" session share a day.

"Entries with a value" still counts notes, and your existing goals don't
change.

### Fixes

- Notes created from a Starter Kit note type keep the spaces of the name
  prefix and suffix: `2026-11-03 (Strength Session)`, not
  `2026-11-03(Strength Session)`.
- Values captured into a daily note the plugin had just created from its
  template could be lost: Templater could process the new note a second time
  and overwrite them. The plugin now keeps Templater away from a note it has
  just created.
- Turning the plugin off and on again quickly, or a hot reload, could fail
  with "Action life-tracker-quick-add is already registered". That no longer
  happens.
- The documentation was wrong about dates. With a **Date anchor** property set
  in a view, that property comes first, before the file name. The plugin
  already worked that way; the docs now say so.

## 3.2.0 (2026-10-14)

### Saturday as the first day of the week

**First day of the week** (Settings → Dates) now offers Saturday next to Monday
and Sunday. Weekly grouping, heatmap week columns and day labels, and "this
week" / "last week" ranges all follow it. ISO week labels (`2026-W42`) stay
Monday-based.

### Settings changed elsewhere are no longer overwritten

When `data.json` changed outside Obsidian (Obsidian Sync, a git pull, a hand
edit) while the plugin was running, the next settings change wrote the old
settings back and silently discarded the external change. The plugin now reloads
its settings when the file changes on disk, refreshes open views and an open
settings tab, and never writes during the reload. A file caught mid-write by a
sync tool, or briefly missing, is ignored instead of resetting your settings.
Thanks to Andrii Oriekhov.

### Multi-line property descriptions

A description written one line per value (`none — no headache`, `mild — …`) now
keeps its line breaks in the capture dialog instead of turning into one run-on
line. Used as an input's placeholder, its lines are joined with " · ". A
property without a description now shows its name as the placeholder. Thanks to
Andrii Oriekhov.

## 3.1.0 (2026-10-14)

### Quick add: log a value in one tap

For the things you log many times a day (a glass of water, a set of calf raises,
a cup of coffee), opening the full capture dialog was too much friction.

- **Quick add panel**: run **Life Tracker: Quick add** or click the new ribbon
  icon. A small panel lists the properties you picked, each with its −/+ buttons,
  emoji buttons or checkbox. Every tap saves immediately.
- **Back-fill in place**: with a daily note open, the panel edits that day.
  Otherwise it edits today. Use ‹ › to move between days.
- **One-tap links**: `obsidian://life-tracker-quick-add?property=water&increment`
  adds one glass to today's note without opening anything. Put it on your
  phone's home screen (iOS Shortcuts, Android shortcut or widget). Links can
  also `decrement`, `toggle`, `set=<value>` and target a `date=YYYY-MM-DD`.
- **You choose what appears**: turn on **Show in quick add** for a property in
  settings. It is off by default, so the panel stays short.

### Faster capture

- **Auto-advance (optional)**: turn on **Auto-advance after picking a value**
  (Settings → Capture) and the capture dialog moves to the next property as soon
  as you pick from a dropdown, tap an emoji button or toggle a checkbox. Browsing
  a dropdown with the arrow keys does not count as a pick; press Enter instead.
  Thanks to Andrii Oriekhov for this one.
- **The first + on an empty counter now logs 1**: on a property whose range
  starts at 0, like water intake, the first tap used to log 0 and looked like
  nothing happened. **−** still sets 0, so "none today" stays one tap.

### Fixes

- **Missing values no longer chart as 0**: with a value mapping (e.g.
  `none → 0, mild → 1`), a day where the property was never filled in showed up
  as "none" on heatmaps and charts and pulled averages down. It now stays empty.
  Thanks to Andrii Oriekhov.

## 3.0.0 (2026-09-27)

### ⚠ BREAKING CHANGES

- **plugin:** requires Obsidian 1.13.0 (minAppVersion 1.12.0 -> 1.13.0).
  Users on Obsidian 1.12 keep 2.24.4 through versions.json.

Claude-Session: https://claude.ai/code/session_01LM4hi11kohPVqgZNLpjRgh

### Features

- **plugin:** declare the settings for Obsidian 1.13's settings API

### Bug Fixes

- **build:** exclude bun-types alongside @types/bun from the release-age gate
- **build:** harden the release path from the template
- **build:** rebuild versions.json from the published releases
- **plugin:** lowercase the newsletter line

## 2.24.4 (2026-09-03)

## 2.24.3 (2026-09-03)

### Bug Fixes

- capture properties of a freshly created note instead of reporting none

## 2.24.2 (2026-08-31)

### Bug Fixes

- **plugin:** show a completion rate instead of a record for checkboxes

## 2.24.1 (2026-08-30)

### Bug Fixes

- **plugin:** survive a Templater settings migration

## 2.24.0 (2026-08-30)

### Features

- **build:** fail the build on a lockfile the catalog review cannot parse
- **build:** make the rule floor check that it is still wired in
- **build:** refuse commits that loosen the rules instead of fixing the finding
- **plugin:** offer to create today's note when there is none [#160](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/160)
- **plugin:** resolve and create the note a capture is missing
- **plugin:** resolve where a periodic note for a date should live

### Bug Fixes

- **plugin:** line up the property definition rows

## 2.23.1 (2026-08-29)

### Bug Fixes

- **build:** align with the catalog reviewer's archive, ruleset and audit
- **build:** harden the sentence-case exemptions after adversarial review

## 2.23.0 (2026-08-19)

### Features

- **plugin:** add a range chart for start-to-end spans [#81](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/81)
- **plugin:** let charts plot note names on the x-axis
- **plugin:** track and celebrate personal records

### Bug Fixes

- **plugin:** accumulate the target line under a running total
- **plugin:** draw the target and the reference line together
- **plugin:** give the progress ring its own icon
- **plugin:** keep heatmap month labels from overlapping
- **plugin:** stop modal labels from sliding under the inputs

## 2.22.0 (2026-08-19)

### Features

- **plugin:** add a high contrast mode
- **plugin:** add goals, targets and a progress ring [#126](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/126)
- **plugin:** color progress rings by the goal's direction

### Bug Fixes

- **plugin:** hide the drag handle on a maximized card
- **plugin:** inspect on first tap, open on second
- **plugin:** scope filename date patterns to their folder
- **plugin:** span heatmaps over the whole selected period
- **plugin:** treat a missing measurement as unknown, not zero

## 2.21.4 (2026-08-12)

### Bug Fixes

- **plugin:** color numeric pie segments with the heatmap value scale ([#150](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/150))
- **plugin:** label the trend as per-period on running-total charts ([#149](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/149))
- **plugin:** show a persistent label on the required property toggle ([#148](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/148))
- **plugin:** wrap property row controls so inputs stay usable on mobile ([#147](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/147))

## 2.21.3 (2026-08-12)

### Bug Fixes

- **plugin:** maximize the clicked graph, not its property sibling ([#151](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/151))

## 2.21.2 (2026-08-12)

### Bug Fixes

- **plugin:** apply the default value to the editor in the capture modal ([#145](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/145))
- **plugin:** refresh the view when the time granularity changes ([#146](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/146))

## 2.21.1 (2026-08-11)

### Bug Fixes

- **plugin:** address adversarial review findings on the 2.21.0 changes, closes [143/#144](https://github.com/143/obsidian-life-tracker-base-view/issues/144) [#144](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/144)
- **plugin:** rebuild the chart when a property flips between numeric and list

## 2.21.0 (2026-08-11)

### Features

- **plugin:** add a running total option for line and area charts ([#142](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/142))

### Bug Fixes

- **plugin:** keep the visualization settings toolbar inside the dialog ([#143](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/143))
- **plugin:** show the column layout icons and let charts fill the card ([#144](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/144))

## 2.20.2 (2026-08-01)

### Bug Fixes

- **plugin:** show the Starter Kit tab only when Starter Kit is present

## 2.20.1 (2026-07-31)

### Bug Fixes

- **build:** only record a versions.json entry when the minimum changes

## 2.20.0 (2026-07-30)

### Features

- **plugin:** custom heatmap color mappings and colorblind-friendly palettes [#136](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/136) [#82](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/82) [#136](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/136)
- **plugin:** import linked property definitions from Obsidian Starter Kit
- **plugin:** link Starter Kit properties by stable id so renames survive
- **plugin:** value polarity and value/range emojis [#22](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/22) [#21](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/21) [#22](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/22) [#21](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/21) [#21](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/21) [#22](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/22)

### Bug Fixes

- **build:** record every release in versions.json, and lint before tagging
- **plugin:** keep display names on link, and make Starter Kit import scale
- **plugin:** serialize settings writes, editable map keys, heatmap auto scheme, closes [21/#22](https://github.com/21/obsidian-life-tracker-base-view/issues/22)

## 2.19.0 (2026-07-30)

### Features

- **plugin:** pinned cards, progressive rendering, quick number entry, mobile swipe [#123](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/123) [#125](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/125) [#135](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/135) [#140](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/140)

## 2.18.0 (2026-07-30)

### Features

- **plugin:** custom filename date patterns
- **plugin:** show what's new in a tab instead of a modal dialog
- **plugin:** surface support CTAs everywhere users can see them

## 2.17.0 (2026-07-29)

### Features

- **plugin:** aggregate what's new dialogs across simultaneously updated plugins

## 2.16.0 (2026-07-29)

### Features

- **plugin:** add Knowii community to the what's new dialog and harden it

## 2.15.0 (2026-07-27)

### Features

- **plugin:** capture modal quick wins ([#106](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/106))
- **plugin:** chart tooltip polish ([#103](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/103))
- **plugin:** configurable number slider step + min/max feedback ([#107](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/107))
- **plugin:** scatter chart real time axis + stack-safe min/max ([#97](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/97))
- **plugin:** show a what's new dialog once after plugin updates

### Bug Fixes

- **plugin:** allow decimal values in number property inputs

## 2.14.2 (2026-07-17)

## 2.14.1 (2026-06-17)

## 2.14.0 (2026-06-17)

### Features

- **plugin:** heatmap sum aggregation and configurable week start ([#98](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/98), [#99](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/99))

### Bug Fixes

- **plugin:** apply per-card config changes without a full-grid rebuild
- **plugin:** keep the dashboard stable during full re-renders

### Performance Improvements

- **plugin:** debounce visualization rebuilds on data updates

## 2.13.0 (2026-06-10)

### Features

- **plugin:** add ARIA roles and keyboard navigation across the UI
- **plugin:** add moving average overlay and trend indicators [#21](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/21) [#101](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/101)
- **plugin:** anchor the trend arrow to the title and add a trend row
- **plugin:** export charts as PNG and displayed data as CSV
- **plugin:** polish animations across cards and the capture carousel

### Bug Fixes

- **plugin:** keep date editor values on the local calendar day
- **plugin:** keep heatmap legend visible while scrolling
- **plugin:** keep heatmap streak stats visible while scrolling
- **plugin:** keep reference lines visible outside the data range
- **plugin:** let the visualization options column scroll in the popover
- **plugin:** pin legend and trend/streak rows to the card bottom
- **plugin:** prevent stale chart instances after rapid re-renders
- **plugin:** resolve batch capture provider by most recent interaction
- **plugin:** show a single tooltip on the trend indicator
- **plugin:** stop leaking viewport listeners on grid view re-renders
- **plugin:** stop spurious render cache invalidation after GC
- **plugin:** use the Obsidian-styled tooltip on the trend indicator

## 2.12.0 (2026-06-10)

### Features

- **plugin:** add capture today command
- **plugin:** respect reduced motion preference and restore focus rings
- **plugin:** show streak stats on heatmaps [#100](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/100)

### Bug Fixes

- **plugin:** flush pending grid view edits before re-render teardown
- **plugin:** render missing chart values as gaps instead of zeros
- **plugin:** validate capture modal auto-saves and surface save failures

## 2.11.0 (2026-06-02)

### Features

- **plugin:** support sum aggregation for chart visualizations

## 2.10.0 (2026-06-02)

### Features

- **all:** added option to hide header buttons

### Bug Fixes

- **all:** fixed heatmap colors

## 2.9.0 (2026-05-19)

### Features

- **all:** automatically show newest data in heatmap visualizations

## 2.8.1 (2026-05-18)

### Bug Fixes

- **all:** fixed issue with previous year data colors in heatmaps

## 2.8.0 (2026-05-18)

### Features

- **all:** enable reordering charts in the Life Tracker base view

## 2.7.4 (2026-05-16)

### Bug Fixes

- **plugin:** update view option type definition ([#84](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/84))

## 2.7.3 (2026-05-15)

### Bug Fixes

- **plugin:** filter null/undefined from multi-value property parsing

## 2.7.2 (2026-05-14)

## 2.7.1 (2026-05-13)

## 2.7.0 (2026-05-13)

### Features

- **all:** added docs
- **all:** added release notes update
- **all:** added support for hiding individual charts when there is an overlay
- **all:** updated release script
- **all:** updated scripts

## 2.6.2 (2026-01-30)

### Features

- **all:** added release and validate scripts

## 2.6.1 (2026-01-30)

### Features

- **all:** isolated styles and removed tw reset

## 2.6.0 (2026-01-05)

### Features

- **all:** added support for value mappings

## 2.5.0 (2026-01-03)

### Features

- **all:** added reference line support in visualization customizations
- **all:** added support for reference lines on visualizations with multiple properties

### Bug Fixes

- **all:** fixed issue with maximizing charts with multiple props

## 2.4.0 (2026-01-03)

### Features

- **all:** add better support for lists. The values are now considered in isolation and aggregated correctly

### Bug Fixes

- **all:** fixed broken test

## 2.3.0 (2025-12-22)

### Features

- **all:** added support for creating visualizationss with multiple properties

## 2.2.1 (2025-12-20)

### Bug Fixes

- **all:** fixed default state for show empty values

## 2.2.0 (2025-12-17)

## 2.1.0 (2025-12-17)

### Features

- **all:** enabled adding multiple visualizations for the same property

## 2.0.0 (2025-12-16)

### Features

- **all:** enabled changing the time frame for the life tracking grid (base view options)

### Bug Fixes

- **all:** filtered the dataset given to the bulk processing command

## 1.9.0 (2025-12-16)

### Features

- **all:** enabled changing the time frame for the life tracker view
- **all:** improved visualizations resizing based on available space

### Bug Fixes

- **all:** removed visualization as soon as a property is removed from the life tracker view

## 1.8.1 (2025-12-16)

### Features

- **all:** enabed copying an existing property definition

## 1.8.0 (2025-12-16)

### Features

- **all:** added more per-visualization customization options for heatmaps
- **all:** enabled customizing visualization colors

### Bug Fixes

- **all:** better handled color customization for boolean pie and doughtnut charts
- **all:** fixed tooltip display for heatmaps

## 1.7.0 (2025-12-15)

### Features

- **all:** enabled using default values in the data entry modal
- **all:** made the grid responsive (becomes a cards view on mobile)

## 1.6.0 (2025-12-15)

### Features

- **all:** added support for rendering visualizations for formulas
- **all:** added support for rendering visualizing properties (eg file tags as a cloud)
- **all:** better handled different chart types and fixed rendering
- **all:** enabled reordering property definitions
- **all:** harmonized label generation across all chart types
- **all:** normalized chart sizes
- **all:** reduced the number of visualization re-renders after configuration or data changes
- **all:** removed the card height setting in the Life Tracker Base view

### Bug Fixes

- **all:** added some delay to validations in the grid to avoid losing input focus too quickly
- **all:** fixed issue where the visualization context menu did not reflect the current state
- **all:** fixed label positioning for timeline chart
- **all:** fixed labels for timeline charts
- **all:** stop animations when maximizing/minimizing charts
- **all:** the cached data is now updated correctly when base data changes

## 1.5.0 (2025-12-14)

### Features

- **all:** added mobile support for the data entry modal

## 1.4.0 (2025-12-14)

### Features

- **all:** better handle the date anchor setting and add support for more date/time formats
- **all:** display boolean values more nicely (True|False instead of true|false)
- **all:** improved performances of the Life Tracker view

### Bug Fixes

- **all:** fixed rendering of the property edition modal (space for slider vs space for input)

## 1.3.0 (2025-12-14)

### Features

- **all:** assigned colors based on value for boolean data
- **all:** improved performances by limiting re-rendering
- **all:** improved rendering of line charts

### Bug Fixes

- **all:** improved rendering of heatmap visualizations (fixed misalignment)

## 1.2.0 (2025-12-13)

### Features

- **all:** added batch mode support for the command and modal
- **all:** added capture command and a new grid base view type
- **all:** enhanced handling of empty/null values in visualizations (new setting)
- **all:** improved navigation across properties with the modal
- **all:** improved validation in modal and grid. Only valid values may be entered now

### Bug Fixes

- **all:** fixed bug where the heatmap color did not changed according to the setting

## 1.1.1 (2025-12-12)

### Bug Fixes

- **all:** fixed issue where after minimizing a maximized card, another was maximized
- **all:** fixed the release workflow to name the tags correctly

## 1.1.0 (2025-12-12)

### Features

- **all:** avoid fully recreating the base view when grid settings are changed (eg number of columns)
- **all:** renamed the plugin (wider scope)

## 1.0.0 (2025-12-12)

### Bug Fixes

- **all:** fix matching between columns and global visualization presets

## 0.2.0 (2025-12-12)

### Features

- **all:** added new visualization types

### Bug Fixes

- **all:** fix issue with settings update

## 0.1.0 (2025-12-12)

### Features

- **all:** adapt visualizations based on date granularity
- **all:** added github ci and release workflows
- **all:** added plugin shell
- **all:** added release scripts
- **all:** added setting for the animation duration
- **all:** handle copying the assets in the build script and also copying the required files
- **all:** improve the display and controls
- **all:** improved animations (show values over time)
- **all:** initial implementation (vibe-coded)
- **all:** removed animations for heatmaps (nok)
- **all:** updated build to also take care of the CSS with Tailwind
- **build:** handle copying manifest.json and versions.js in the build script
