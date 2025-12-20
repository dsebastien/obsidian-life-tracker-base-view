# Life Tracker Plugin - Improvement Brainstorm

**Status**: Reference document / Future backlog
**Created**: 2025-12-17
**Purpose**: Ideas for future development, organized by effort and impact

### UX/UI Enhancements

Quick-Add Widget

- **Idea**: Floating button or status bar widget for rapid data entry without opening capture modal
- **Why**: Reduce friction for frequent tracking (e.g., water intake, mood)
- **Details**: One-tap increment for numbers, toggle for booleans

Keyboard Shortcuts

- **Idea**: Add hotkeys for common actions in visualization view
- **Why**: Power users want speed
- **Details**: Arrow keys to navigate cards, number keys to switch viz types, 'M' to maximize

- Arrow keys to navigate cards
- `M` to maximize focused card
- Number keys (1-9) to switch viz types
- `Escape` already works for minimize
- **Files**: `src/app/view/life-tracker-view.ts`

Card Favorites/Pinning

- **Idea**: Pin favorite visualizations to top of grid
- **Why**: Most important metrics always visible first
- **Details**: Star icon, pinned cards stay at top regardless of sort

Drag and Drop visualizations to reorder those (persist the chosen order and update it when it changes)

Quick Increment/Decrement Buttons

- For number properties in capture modal: +1/-1 buttons
- One-tap increment for common values (water glasses, pushups)
- **Files**: `src/app/components/editing/number-editor.ts`

Smart Value Suggestions

- Show frequent/recent values
- "Last time: 7 hours" quick-fill
- Time-of-day patterns
- **Files**: `src/app/components/modals/property-capture-modal.ts`, editors

### New Visualization Types & Enhancements

Goal Tracking System

- Define goals per property (e.g., "Exercise 5 days/week")
- Track completion rate
- Progress visualization
- **Files**: New goal types, settings UI, visualization integration

Personal Records Tracking

- Track and display personal bests
- "New record!" notifications
- Records history
- **Files**: New `src/app/services/records.service.ts`

Streak Counter

- **Idea**: Dedicated streak visualization (consecutive days with data/goal met)
- **Why**: Streaks are highly motivating for habit tracking
- **Details**: Current streak, longest streak, streak calendar, streak flames animation

Streak Flames Animation

- Visual flair for long streaks
- Animated fire icon that grows with streak length
- **Files**: CSS animations, streak visualization

Streak Counter Visualization

- Show current streak, longest streak
- Streak calendar (mini heatmap of consecutive days)
- Animated flame for active streaks
- **Files**: New `src/app/components/visualizations/streak/streak-visualization.ts`

Progress Ring/Gauge

- **Idea**: Circular progress indicator for goals
- **Why**: Quick visual of goal progress (e.g., 7000/10000 steps)
- **Details**: Customizable goal target, color thresholds (red/yellow/green)

Progress Ring/Gauge

- Circular progress toward goal
- Configurable target value
- Color thresholds (red/yellow/green zones)
- Perfect for daily goals (steps, water, meditation minutes)
- **Files**: New `src/app/components/visualizations/progress-ring/`

Comparison Chart

- **Idea**: Overlay multiple properties on single chart
- **Why**: See correlations (sleep vs mood, exercise vs energy)
- **Details**: Multi-axis support, legend toggle per property

Comparison/Overlay Chart

- Overlay 2+ properties on same axes
- See correlations visually
- Dual Y-axis support for different scales
- **Files**: `src/app/components/visualizations/chart/chart-visualization.ts`

Calendar View

- **Idea**: Month calendar with color-coded days
- **Why**: GitHub-style heatmap is great, but traditional calendar is more familiar
- **Details**: Mini-calendar widget, click day to see entries

Sparklines

- **Idea**: Tiny inline charts in table/grid cells
- **Why**: Quick trend visibility without full visualization
- **Details**: 7-day sparkline in grid view cells

Sparklines in Grid View

- Tiny 7-day trend line in table cells
- Quick visual without full chart
- **Files**: `src/app/view/grid-view/`, new sparkline component

Sankey/Flow Diagrams

- **Idea**: Visualize transitions (e.g., mood flow day-to-day)
- **Why**: See patterns in categorical data changes
- **Details**: Good for tracking state transitions

Histogram

- **Idea**: Distribution visualization for numeric properties
- **Why**: See what values are most common, outliers
- **Details**: Configurable bin count, percentile markers

### Data Entry & Capture Improvements

Bulk Edit Mode

- **Idea**: Parse "Slept 7.5 hours, mood was good" into structured data
- **Why**: More natural interaction
- **Details**: Local parsing (no cloud), configurable mappings

Daily/Weekly Review Prompt

- **Idea**: Scheduled reminder to review and fill missing data
- **Why**: Ensure data completeness
- **Details**: Show week summary, highlight gaps, one-click to fill

Weekly Summary Command

- Generate markdown note with week's stats
- Averages, totals, streaks, trends
- Highlight personal records
- **Files**: New `src/app/commands/summary-command.ts`

### Analytics & Insights

Automatic Correlations

- **Idea**: Detect and highlight correlations between tracked properties
- **Why**: "Your mood tends to be higher on days you exercise"
- **Details**: Statistical correlation, significance indicator

Automatic Correlation Detection

- Calculate correlation coefficients between numeric properties
- Surface insights: "Mood correlates with sleep (r=0.72)"
- Correlation matrix visualization
- **Files**: New `src/app/services/analytics.service.ts`

Trend Detection

- **Idea**: Show trend arrows (↑ improving, ↓ declining, → stable)
- **Why**: Quick understanding of direction
- **Details**: Configurable trend period, percentage change

Trend Indicators on Cards

- Add ↑↓→ trend arrows showing direction over configurable period
- Show percentage change on hover
- Minimal code: add to card header/footer
- **Files**: `src/app/components/ui/column-config-card.ts`, `src/app/services/data-aggregation.service.ts`

Anomaly Detection

- **Idea**: Highlight unusual values
- **Why**: Catch data entry errors, notable events
- **Details**: Standard deviation based, configurable sensitivity

Year in Review

- Annual summary like Spotify Wrapped
- Fun stats, patterns, achievements
- Generate as markdown note
- **Files**: New command, template generation

Achievement Badges

- Milestone achievements (100 entries, 30-day streak)
- Badge gallery in settings or dedicated view
- Optional (can disable)
- **Files**: New `src/app/services/achievements.service.ts`, badge definitions, UI

### Performance & Technical

Data Caching

- **Idea**: Cache aggregated data, invalidate on file changes
- **Why**: Faster re-renders, less CPU usage
- **Details**: Per-property cache with timestamps

Progressive Enhancement

- **Idea**: Basic view loads instantly, charts enhance progressively
- **Why**: Perceived performance improvement
- **Details**: Skeleton screens, animation on load

### Accessibility & Inclusivity

Screen Reader Support

- **Idea**: ARIA labels for all visualizations
- **Why**: Accessibility for visually impaired users
- **Details**: Describe trends, values in text form

Colorblind-Friendly Palettes

- **Idea**: Color schemes optimized for color vision deficiency
- **Why**: ~8% of males have some form of colorblindness
- **Details**: Deuteranopia, Protanopia, Tritanopia safe palettes

High Contrast Mode

- **Idea**: Maximum contrast option for visibility
- **Why**: Some users need high contrast
- **Details**: Thick borders, strong colors

Reduced Motion Option

- **Idea**: Disable all animations for vestibular sensitivity
- **Why**: Animations can cause discomfort for some
- **Details**: Global toggle, respects prefers-reduced-motion

### Quality of Life

Undo/Redo for Edits

- **Idea**: Undo accidental property changes
- **Why**: Mistakes happen
- **Details**: 10-step undo history, visual feedback

Custom Date Formats

- **Idea**: Support various date formats in filenames
- **Why**: Users have different naming conventions
- **Details**: Configurable date parsing patterns

Mobile-Optimized Capture

- **Idea**: Swipe gestures, larger touch targets
- **Why**: Better mobile experience
- **Details**: Swipe left/right between properties

Mobile Swipe Navigation

- Swipe between properties in capture modal
- Larger touch targets
- **Files**: `src/app/components/modals/property-capture-modal.ts`

Quick Notes/Comments

- **Idea**: Add context notes to specific data points
- **Why**: "Low mood because of bad news"
- **Details**: Optional comment field per property entry
