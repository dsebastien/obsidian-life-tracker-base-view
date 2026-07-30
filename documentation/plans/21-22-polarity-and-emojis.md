# Value polarity (#21) + value/range emojis (#22)

Status: **done** — implemented 2026-07-30, pending manual runtime verification in a
vault. See `documentation/history/2026-07-30.md`, including the open question about
whether the polarity-derived heatmap default can ever fire.

## Goal

1. **#21** — say whether high values are good or bad for a property (mood 0-10:
   high is good; cigarettes: high is bad), and let that drive the semantics the
   plugin currently has to keep neutral.
2. **#22** — associate specific values or ranges with emojis, both for rendering
   and for entering data by tapping an emoji.

They ship together because #21 is what makes #22's defaults meaningful, and #21
names #22 as its payoff ("that way, we can map emojis or other fun things").

## Design

### Polarity (#21)

New `polarity` on `PropertyDefinition`: `'neutral'` (default) | `'higher-is-better'`
| `'lower-is-better'`. Default neutral means **no existing vault changes
behavior**.

What it drives:

- **Trend arrow color and wording.** `documentation/Business Rules.md` currently
  says the arrow "stays neutral: whether up is good depends on the tracked
  metric (see issue #21)" — this is the deferred behavior that issue was filed
  for. With a polarity set, ↑ on higher-is-better reads as improving (green) and
  ↑ on lower-is-better reads as worsening (red); neutral keeps today's muted
  arrow. Wording follows in the tooltip and the trend row.
- **Default heatmap gradient.** Green for higher-is-better, red for
  lower-is-better — "more color = more of the thing" then reads correctly in
  both directions.

Precedence for the heatmap gradient: per-card scheme → view-wide
`heatmapColorScheme` → polarity-derived → green. Polarity is the _default_, never
an override: anything the user picked explicitly wins.

> Caveat to verify in a vault: if Obsidian materializes a declared view-option
> `default` into the stored config, `getStringConfig` will return `'green'` even
> when untouched and the polarity default will never apply to heatmaps. The trend
> arrow is unaffected — it does not read view config.

### Emojis (#22)

New `valueEmojis` on `PropertyDefinition`: `Record<string, string> | null`, keys
being an exact value (`"3"`) or an inclusive range (`"1-2"`). Ranges are in scope
here because the issue asks for them by name (they were deferred in #82).

Distinct from the existing `valueMapping`, which converts _text → number_ for
input parsing. `valueEmojis` goes the other way: _number → emoji_ for display.
Both can coexist on one property.

Resolution order: exact match first, then the first matching range in insertion
order. A value matching nothing renders with no emoji.

Where it shows up:

- Heatmap cell tooltips and chart tooltips, prefixed to the value.
- The capture modal: properties with an emoji mapping get a row of emoji buttons
  for one-tap entry — the "editing through emojis" half of the issue.

## Steps

1. `property-definition.types.ts` — `ValuePolarity`, `polarity`, `EmojiMapping`,
   `valueEmojis`; defaults in `createDefaultPropertyDefinition`.
2. New `src/utils/polarity.utils.ts` — `resolveTrendSentiment(direction, polarity)`
   and the polarity-derived gradient name. Pure + tested.
3. New `src/utils/emoji-mapping.utils.ts` — `resolveValueEmoji(value, mapping)`,
   range-key parsing/validation, `formatValueWithEmoji`. Pure + tested.
4. `visualization-config.helper.ts` — accept the property definition; carry
   `polarity` and `valueEmojis` on the base `VisualizationConfig`.
5. `chart-visualization.ts` — color and word the trend arrow by sentiment.
6. `tooltip.ts` — emoji prefix in heatmap and chart tooltips.
7. `property-capture-modal.ts` — emoji quick-pick buttons.
8. `property-definition-section.ts` — polarity dropdown + emoji mapping editor
   (mirrors the existing value-mapping editor).
9. CSS, tests, docs, business rules, history.

## Open questions

- Should polarity also flip the _chart_ palette? Deliberately not: a line chart's
  color identifies the series, not its goodness. Only the trend indicator carries
  sentiment.
- Emoji rendering directly inside heatmap cells is out of scope — cells are 8-20px
  and the emoji would be illegible. Tooltips and the capture modal only.
