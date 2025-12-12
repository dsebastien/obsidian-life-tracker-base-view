Ultrathink.

Create a highly detailed and concrete plan to build a custom type of Obsidian Base View called "Life Tracker". When you write it, be clear, terse, to the point. Sacrifice grammar for clarity/conciseness. Don't write fluff. Don't include timing. Ask me questions, I'm an expert. You're not a mind reader.

- First, read the obsidian typescript types
- Then, explore /home/dsebastien/wks/obsidian-developer-docs/en/Reference to understand the APIs that related to Obsidian bases
- You can also look at the following project to see how a custom view type is created: /home/dsebastien/wks/obsidian-maps

The goal of this custom view type is to render the different rows in the Base visually as github-contribution-like charts, and different types of graphs, charts, tag clouds, ... depending on the detected data types.

This should help visualize progress, consistency, efforts, ...

For example, if the Base view includes a column called "slept_well" that looks like a boolean (1/0 or true/false, ...), then a github-contribution-like chart should be rendered for that property, visualizing how that evolved over time

Organize the code logically, separating the data gathering/analysis (i.e., what is the type of this column, what visualization type to use for it, ...) from the pure visualization (just taking input and rendering) from pure utilities, constants, etc.
For the visualizations, create dedicated components for each type.

At first, there should be a 1:1 mapping between a data type and a visualization type.

If specific visualizations require a time anchor, either use the note name (e.g., daily notes with YYYY-MM-DD, weekly notes with YYYY-Wxy, ...) or note properties (e.g., created, updated, date, ...) or fallback to file creation/modification times (all retrieved through Obsidian/Base APIs).

In a next stage, users should be able to customize rendering, forcing specific visualizations, customizing each, adding multiple visualization types for specific columns, etc. Carefully analyze those evolutions.

Research the best visualization libraries to use and pick a top 3, knowing that we use TypeScript and that React or other frameworks should be avoided if possible.

Analyze required/optional plugin settings (i.e., global), as well as Base view settings (i.e., Base-view-specific)
