# Life Tracker Plugin for Obsidian

Capture and visualize the data that matters in your life. This Obsidian plugin adds a "Life Tracker" Base View type that transforms your tracked data into beautiful visualizations.

You can find more details and background information here: https://www.knowii.net/c/announcements/new-obsidian-plugin-life-tracker

## Features

### Visualizations

- **12 visualization types**: Heatmap, Line, Bar, Area, Pie, Doughnut, Radar, Polar Area, Scatter, Bubble, Tag Cloud, Timeline
- **GitHub-style heatmaps** with 5 color schemes (green, blue, purple, orange, red)
- **Animated charts** with configurable duration and play/pause controls
- **Interactive elements**: click chart elements to open source notes, hover for detailed tooltips

### Customization

- **Per-view settings**: time granularity (daily to yearly), date anchor property, layout options
- **Grid layout controls**: adjustable columns (1-6) and card height
- **Visualization presets**: auto-apply settings to properties by name pattern
- **Scale configuration**: auto-detect or manual min/max for numeric visualizations
- **Chart options**: toggle legend, grid lines, and more

### Property Capture

- **Property definitions**: configure trackable properties with types (text, number, checkbox, date, list, tags), defaults, and constraints
- **Capture command**: quick dialog to fill properties for the active note or batch process multiple notes
- **Carousel interface**: navigate through properties one at a time with progress tracking
- **Batch mode**: process notes from Grid View or Life Tracker View with smart filtering (skip complete notes)
- **Auto-save**: values saved automatically as you type with visual feedback
- **Grid View**: card-based Base view type for editing properties across multiple notes

### User Experience

- **Context menu**: right-click any card to change visualization, configure scale, maximize, or reset
- **Maximize mode**: expand any visualization to full view (press Escape to exit)
- **Persistent settings**: grid layout and card configurations saved per view
- **Empty states**: helpful messages when data is missing or misconfigured
- **Confetti celebration**: optional animation when completing property capture

## Screenshots

### Dashboard with multiple visualizations

![Visualizations](documentation/screenshots/visualizations.png)
View your tracked data with different visualization types: area charts, heatmaps, bar charts, and line charts in a grid layout.

### Select visualization type

![Select visualization type](documentation/screenshots/select-visualization-type.png)
Choose from 12 visualization types when configuring a new property: Heatmap, Bar Chart, Line Chart, Area Chart, Pie Chart, Doughnut Chart, Radar Chart, Polar Area Chart, Scatter Chart, Bubble Chart, Tag Cloud, and Timeline.

### Customize time granularity

![Customize granularity](documentation/screenshots/customize-granularity.png)
Set the time granularity for your visualizations: Daily, Weekly, Monthly, Quarterly, or Yearly.

### Configure view settings

![Configure view settings](documentation/screenshots/customize-base-view-settings.png)
Adjust layout options including number of columns, empty date display, default chart type, and legend visibility.

### Right-click context menu

![Customize visualizations](documentation/screenshots/customize-visualizations.png)
Right-click any card to change visualization type, configure scale (auto-detect or preset ranges like 0-1, 0-5, 0-10, 0-100), maximize, or reset configuration.

### Maximize view

![Zoom in](documentation/screenshots/zoom-in.png)
Expand any visualization to full view for detailed analysis. Press Escape to exit.

### Global settings and presets

![Global settings](documentation/screenshots/configure-global-settings-and-presets.png)
Configure animation duration and create visualization presets that auto-apply to properties matching specific name patterns.

## Property definitions

Property definitions let you configure which frontmatter properties to track across your vault. Each definition specifies:

- **Property name**: The frontmatter key to track (e.g., `mood`, `weight`, `exercise`)
- **Type**: text, number, checkbox, date, datetime, list, or tags
- **Constraints**: Optional min/max for numbers, allowed values for text/list/tags
- **Default value**: Pre-filled when capturing new data
- **Note filtering**: Apply the property only to specific notes by folder, tag, or regex pattern

Configure property definitions in **Settings → Life Tracker → Property definitions**. These definitions power the capture command and determine which properties appear in the capture dialog.

## Visualization presets

Visualization presets automatically configure how properties are displayed based on their name. For example, you can set all properties containing "mood" to display as a heatmap with a 1-5 scale.

Configure presets in **Settings → Life Tracker → Visualization presets** by specifying:

- **Property name pattern**: The text to match against property names
- **Visualization type**: Which visualization to use (heatmap, line chart, etc.)
- **Scale**: Optional min/max range for numeric visualizations

**How presets work with overrides**: When you add a property column to a Life Tracker Base View, the plugin checks for matching presets and applies them automatically. However, you can always override the preset configuration for that specific property in that specific view using the right-click context menu. Your per-view overrides take precedence over presets, giving you global defaults with local flexibility.

## Roadmap

See the issues & discussions in this repositories.

## News & support

To stay up to date about this plugin, Obsidian in general, Personal Knowledge Management and note-taking, subscribe to [my newsletter](https://dsebastien.net). Note that the best way to support my work is to become a paid subscriber ❤️.
