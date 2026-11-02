---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

Add dark mode colors: optional `darkColors` on `TemplateSettings` (`backgroundColor`, `textColor`, `linkColor`) and on section (`backgroundColor`), title and paragraph (`backgroundColor`, `textColor`) and button (`backgroundColor` for the fill, `textColor` for the label) blocks, with `hasDarkColors` and `isDarkColorSet` helpers in `@templatical/types`.

`renderToMjml` gives each element that sets one a class named after its role and color, and emits one `<mj-style>` holding `!important` rules inside `@media (prefers-color-scheme: dark)` and under Outlook's `[data-ogsc]` (text) and `[data-ogsb]` (backgrounds) attributes. It adds no `<meta>` tag and no `color-scheme` property. A template without dark colors renders byte for byte as before.

The editor has a Dark Mode group in the settings of those blocks and in the template settings, and its dark mode preview shows a template's dark colors where they are set instead of inverting the canvas; a template without any keeps the inverted preview. The template-tools and ai-kit content schemas accept the new fields.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
