# Parfait Admin dashboard: overrides to MASTER.md

These rules **override** `../MASTER.md` for every admin screen. MASTER.md is the raw
ui-ux-pro-max output, kept unedited as the record. The source of truth for values is
`src/admin/styles/tokens.css`.

## Direction

The target tone is the Toss Payments merchant dashboard, built for non-developers
(planners, designers, marketers). That means a light-gray page with white rounded cards,
one blue accent, large bold numbers, generous whitespace and 해요체 copy. Plain Korean
comes first and the original GA term is shown small and secondary. Dark mode follows
`prefers-color-scheme`.

## Kept from MASTER

- Blue as the data/primary hue. Light-gray background with white cards.
- The 4/8/16/24/32/48/64 spacing rhythm, extended to a 4px-base scale.
- The accessibility checklist: 4.5:1 text contrast, visible focus, reduced motion,
  SVG icons (no emoji icons), and 44px hit areas.
- The chart guidance: line chart for trends, and a stat card when there are fewer than
  4 points. Keyboard focus reveals the same detail as hover. Never use color alone to
  carry meaning (deltas always carry ▲/▼ text).

## Rejected from MASTER

| MASTER suggestion | Why rejected | Replacement |
|---|---|---|
| Pattern "Enterprise Gateway" (hero video, client logos, contact sales) | A marketing landing pattern that is off-topic for an internal dashboard | Card grid of KPIs and reports |
| Style "Data-Dense Dashboard" (minimal padding, max data visibility) | Conflicts with the generous-whitespace direction for non-technical readers | 24px card padding, 20px card radius, fewer items per view |
| Fira Code / Fira Sans | No Hangul glyphs. Pretendard is already the project font | Pretendard Variable plus system Korean fallbacks |
| Amber accent/CTA #D97706 | Only one accent color is allowed | Single blue accent #1B64DA (dark #6AA6FF) |
| Navy foreground #1E3A8A for body text | Tinted body text reads as a link | Neutral near-black #191F28 |
| Blue-tinted border #DBEAFE | Too colorful for Toss-like neutral surfaces | Neutral gray #E5E8EB |
| Shadow scale up to xl | Cards should feel flat and calm | One subtle card shadow plus one popover shadow |
| Red→yellow→green gauge palettes | Multi-hue status colors | Blue up / red down / gray flat, with ▲/▼ text |
