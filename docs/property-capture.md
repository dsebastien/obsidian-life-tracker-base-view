# Property Capture

The Property Capture feature provides a streamlined interface for entering data into your notes.

## Property Definitions

Before capturing data, define which properties to track:

1. Open **Settings → Life Tracker → Property definitions**
2. Click **Add definition**
3. Configure each property:

| Field       | Description                                        |
| ----------- | -------------------------------------------------- |
| Name        | Frontmatter property key                           |
| Type        | text, number, checkbox, date, datetime, list, tags |
| Default     | Pre-filled value for new entries                   |
| Constraints | Min/max for numbers, allowed values for text       |
| Note filter | Folder, tag, or regex pattern to limit scope       |

## Capture Command

Use the command **Life Tracker: Capture properties** to open the capture modal.

### Single Note Mode

When invoked from a regular note:

- Shows properties defined for that note
- Navigate between properties with arrows
- Values save automatically as you type
- Progress indicator shows completion status

### Batch Mode

When invoked from a Life Tracker or Grid view:

- Processes all notes in the current view
- Navigate between notes and properties
- Filter to show only notes with missing required properties
- Time frame settings are respected (only notes in the selected period)

## Modal Interface

### Navigation

- **Left/Right arrows**: Move between properties
- **Property pills**: Click to jump to a specific property
- **Note selector**: (Batch mode) Switch between notes

### Editors

Each property type has a specialized editor:

| Type     | Editor                                 |
| -------- | -------------------------------------- |
| text     | Text input field                       |
| number   | Numeric input with increment/decrement |
| checkbox | Toggle switch                          |
| date     | Date picker                            |
| datetime | Date and time picker                   |
| list     | Multi-value input with add/remove      |
| tags     | Tag input with autocomplete            |

### Auto-Save

Values are saved automatically as you type:

- Visual feedback shows save status
- No need to click save buttons
- Changes persist immediately to frontmatter

### Progress Tracking

The modal shows:

- Current property position (e.g., "2 of 5")
- Completion percentage
- Visual progress bar

## Filtering Notes (Batch Mode)

In batch mode, use the filter dropdown:

| Filter           | Description                                  |
| ---------------- | -------------------------------------------- |
| All notes        | Show all notes in the view                   |
| Missing required | Only notes with unfilled required properties |
| Missing any      | Notes with any unfilled properties           |

## Time Frame Integration

When capturing from a view with a time frame configured:

- Only notes within that time frame are included
- Lets you focus on a specific period (e.g., "this week")
- Prevents accidentally editing old data

## Confetti Celebration

When you complete all properties for a note, a confetti animation celebrates your progress. This can be disabled in settings.

## Tips

### Efficient Data Entry

1. Set up keyboard shortcuts for the capture command
2. Use default values for common entries
3. Filter to "Missing required" to focus on gaps

### Property Organization

- Order property definitions by frequency of use
- Use descriptive names for clarity
- Group related properties together

### Batch Processing

1. Open a Life Tracker or Grid view
2. Set the time frame to the period you're filling in
3. Use the capture command
4. Filter to "Missing required"
5. Work through notes systematically

### Quick Single-Entry

1. Open the note you want to update
2. Run the capture command
3. Fill in the properties
4. The modal closes when you're done
