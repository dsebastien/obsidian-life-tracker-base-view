# Configuration

## Plugin Settings (Global)

Access via **Settings → Life Tracker**.

### Animation Duration

Control how long chart animations play (in milliseconds).

- **Default**: 3000ms
- **Range**: 0-10000ms
- **Tip**: Set to 0 to disable animations

### Visualization Presets

Auto-apply visualization settings based on property names.

| Field   | Description                          |
| ------- | ------------------------------------ |
| Pattern | Text to match against property names |
| Type    | Visualization type to apply          |
| Scale   | Optional min/max range               |
| Color   | Optional color scheme                |

**Example**: Pattern `mood` with Heatmap type and 1-5 scale applies to all properties containing "mood" in the name.

**Override behavior**: Local per-view configurations always take precedence over presets.

### Property Definitions

Configure trackable properties for the capture command. See [Property Capture](property-capture.md) for details.

## Life Tracker View Options

Configured via the view's settings panel (gear icon).

| Option            | Default  | Description                         |
| ----------------- | -------- | ----------------------------------- |
| Granularity       | daily    | Time grouping (daily to yearly)     |
| Time frame        | all_time | Date range filter                   |
| Date anchor       | (auto)   | Property to use for date resolution |
| Grid columns      | 3        | Number of columns (1-6)             |
| Show legend       | true     | Display chart legends               |
| Show empty dates  | true     | Include dates with no data          |
| Cell size         | 12       | Heatmap cell size in pixels         |
| Show day labels   | true     | Day labels on heatmaps              |
| Show month labels | true     | Month labels on heatmaps            |
| Embedded height   | 400      | Height when embedded (pixels)       |

## Grid View Options

| Option     | Default  | Description                  |
| ---------- | -------- | ---------------------------- |
| Time frame | all_time | Date range filter for notes  |
| Hide notes | required | When to hide completed notes |

**Hide notes options**:

- `required`: Hide when required properties are filled
- `all`: Hide when all properties are filled
- `never`: Always show all notes

## Per-Visualization Config

Stored per view, per visualization. Access via right-click context menu.

| Setting         | Description                                |
| --------------- | ------------------------------------------ |
| Type            | Visualization type                         |
| Scale           | Min/max range (auto or preset)             |
| Color scheme    | Color palette (green, blue, purple, etc.)  |
| Reference line  | Target line with value and label           |
| Heatmap options | Cell size, day/month labels (heatmap only) |

## Overlay Config

Stored per view. Access via overlay card context menu.

| Setting                        | Description                           |
| ------------------------------ | ------------------------------------- |
| Display name                   | User-defined overlay name             |
| Chart type                     | Line, Bar, or Area                    |
| Properties                     | Array of property IDs (minimum 2)     |
| Scale                          | Shared Y-axis min/max                 |
| Color scheme                   | Color palette                         |
| Reference lines                | Per-property target lines             |
| Hide individual visualizations | Hide separate cards for overlay props |

## Scale Presets

Available for numeric visualizations:

| Preset | Range    |
| ------ | -------- |
| Auto   | Dynamic  |
| 0-1    | 0 to 1   |
| 0-5    | 0 to 5   |
| 1-5    | 1 to 5   |
| 0-10   | 0 to 10  |
| 1-10   | 1 to 10  |
| 0-100  | 0 to 100 |

## Color Schemes

Available for all chart types except Tag Cloud:

- `green` (default)
- `blue`
- `purple`
- `orange`
- `red`

## Date Anchor Resolution

Priority order for determining entry dates:

1. **Filename pattern**: YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq
2. **Date anchor property**: Configured in view settings
3. **File metadata**: ctime or mtime

## Configuration Priority

For visualization settings:

1. **Per-view column config**: Highest priority
2. **Global preset**: Applied if no local config exists
3. **Default/unconfigured**: Shows selection card
