---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/quality": patch
"@templatical/import-mjml": patch
"@templatical/template-tools": patch
"@templatical/ai-kit": patch
---

A title can have a size and a line height of its own. The title settings gain a Font Size field (any whole px) and a Line Height field (steps of 0.05), both finer than the paragraph presets. An empty field leaves the value to the default and shows it as the placeholder: the heading level's size, and `1.3`. Emptying a field is how a title goes back to the default. The heading level keeps deciding the heading element, so a resized H1 is still the email's main heading.

`TitleBlock` gains optional `fontSize` (px) and `lineHeight` (a multiple of the font size). A title without them renders byte for byte as before. `resolveTitleFontSize(block)` and `resolveTitleLineHeight(block)` return the values a title renders at, falling back to `HEADING_LEVEL_FONT_SIZE` and `TITLE_LINE_HEIGHT` when the title sets none or sets one that is not a positive number; the renderer, the canvas and the quality rules all read them.

`a11y.text-low-contrast` judges a title by the size it renders at, and `a11y.text-too-small` now checks titles too. The MJML importer reads a title's `font-size` and `line-height` back when they differ from the level's defaults, so an exported title survives a round trip. The template schema accepts the two fields.
