---
title: Styling
description: Block styles, spacing, visibility, and template-level settings in Templatical.
---

# Styling

Every block in Templatical carries a `styles` property for layout and appearance, plus `visibility` for per-viewport control.

## BlockStyles

The `BlockStyles` interface controls padding and background.

```ts
interface BlockStyles {
  padding: SpacingValue;
  backgroundColor?: string;
}
```

```ts
import { createParagraphBlock } from "@templatical/types";

const block = createParagraphBlock({
  content: "<p>Styled text</p>",
});

block.styles = {
  padding: { top: 16, right: 24, bottom: 16, left: 24 },
  backgroundColor: "#f0f9ff",
};
```

## SpacingValue

Padding uses the `SpacingValue` type with four directional values in pixels.

```ts
interface SpacingValue {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

All four properties are required. Use `0` for sides that need no spacing:

```ts
block.styles = {
  padding: { top: 0, right: 16, bottom: 0, left: 16 },
};
```

## Paragraph spacing

A paragraph block holding more than one `<p>` spaces them by `paragraphSpacing`, in px. Omit it for the built-in `8`; `0` butts the paragraphs together.

```ts
const block = createParagraphBlock({
  content: "<p>First.</p><p>Second.</p>",
  paragraphSpacing: 16,
});
```

The canvas and the exported email apply this identically, so the gap you see in the editor is the gap that ships. It only affects space _between_ paragraphs inside one block — the space around the block is `styles.padding`, and a block with a single paragraph has no internal gap at all.

List spacing is not configurable: MJML resets nothing for `ul`/`ol`/`li`, so those values exist to pin down mail-client defaults rather than to be designed with.

## Block visibility

The `visibility` property on any block controls whether it renders at each breakpoint.

```ts
interface BlockVisibility {
  desktop: boolean;
  mobile: boolean;
}
```

Both default to `true`. Set a breakpoint to `false` to hide the block at that size:

```ts
// Show only on desktop
block.visibility = {
  desktop: true,
  mobile: false,
};
```

This is useful for showing different content at different screen sizes -- for example, a detailed table on desktop and a simplified list on mobile.

## Template-level settings

Beyond individual block styles, the template itself has global settings that affect the overall layout.

| Setting           | Type                 | Description                                                                                                                                                                           |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`           | `number`             | Template content width in px (typically 600)                                                                                                                                          |
| `backgroundColor` | `string`             | Outer background color behind the template                                                                                                                                            |
| `textColor`       | `string`             | Default text color, inherited by every text block (Title, Paragraph, Menu, Table) unless the block sets its own color or an inline text-color mark. Defaults to `#1a1a1a`.            |
| `linkColor`       | `string`             | Document-level link color applied to every link (rich-text and menu). Optional — when unset, links inherit the surrounding text color. A per-block or per-item color still overrides. |
| `linkUnderline`   | `boolean`            | Whether body (rich-text) links are underlined. Defaults to `true`. Buttons and menu items keep their own text-decoration.                                                             |
| `fontFamily`      | `string`             | Default font family for all blocks                                                                                                                                                    |
| `locale`          | `string`             | BCP-47 content language (`<html lang>`). Defaults to `en` on a blank template                                                                                                         |
| `direction`       | `'ltr' \| 'rtl'`     | Writing direction. Unset follows the content language                                                                                                                                 |
| `preheaderText`   | `string`             | Inbox preview line                                                                                                                                                                    |
| `customHeadCss`   | `string`             | Extra CSS for the email's `<head>`. See [Custom head](#custom-head)                                                                                                                   |
| `customHeadTags`  | `string`             | Extra `<head>` tags. See [Custom head](#custom-head)                                                                                                                                  |
| `darkColors`      | `TemplateDarkColors` | Optional colors for readers whose mail app is in dark mode. See [Dark mode colors](#dark-mode-colors).                                                                                |

These are configured through the editor's `init()` config or by modifying the template JSON directly:

```ts
import { init } from "@templatical/editor";

const editor = await init({
  container: "#editor",
  content: {
    settings: {
      width: 640,
      backgroundColor: "#f8fafc",
      textColor: "#1a1a1a",
      linkUnderline: true,
      locale: "en",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    blocks: [],
  },
});
```

Individual blocks can override the template-level `fontFamily` by setting their own `fontFamily` property. When a block does not specify a font family, it inherits from the template settings.

Text color works the same way: text blocks (Title, Paragraph, Menu, Table) inherit `textColor` from the template settings, and any block that sets its own color overrides it. Customize the document default through `init({ templateDefaults: { textColor } })`.

Links follow the same cascade: set a document `linkColor` to apply one color to every link (rich-text and menu), or leave it unset so links inherit the surrounding text color. `linkUnderline` (on by default) underlines body links — buttons and menu items keep their own text-decoration. A per-block or per-item color (e.g. a Menu item's color) still overrides the document link color. Individual rich-text links can also be given their own color in the link dialog, which overrides the document link color — and because the color sits on the link itself, its underline matches.

## Custom head {#custom-head}

A template can carry its own `<head>` content: CSS the built-in styles don't cover, and tags such as `<meta>` or Outlook conditional comments. Authors edit both in the **Custom head** card of the Settings tab; in content they are two settings:

```ts
content.settings.customHeadCss = ".footer a { color: #666666 !important; }";
content.settings.customHeadTags = [
  '<meta name="x-apple-disable-message-reformatting">',
  "<!--[if mso]><style>td { font-family: 'Segoe UI', Arial, sans-serif; }</style><![endif]-->",
].join("\n");
```

The renderer adds them at the end of `<mj-head>`, after every built-in and custom-block rule:

```xml
<mj-raw>
<meta name="x-apple-disable-message-reformatting">
<!--[if mso]><style>td { font-family: 'Segoe UI', Arial, sans-serif; }</style><![endif]-->
</mj-raw>
<mj-style>
.footer a { color: #666666 !important; }
</mj-style>
```

- **CSS is a plain `<style>`.** It is not inlined, so put rules that must survive clients without `<style>` support on the blocks themselves. Coming last, it wins ties with the built-in rules.
- **Conditional comments go in the tags, not the CSS.** MJML strips a comment written directly in `<mj-head>`; the content of `<mj-raw>` reaches the compiled `<head>` as written.
- **The canvas ignores both.** The editor never applies or runs author head content; see it in the export preview or the sent email.
- **Unset or blank adds nothing.** A template without a custom head renders byte for byte as before.
- **Per language.** Like other settings, a language version can override either field in its `l10n` layer.

### What is refused

A value that could break the MJML document or run code is left out of the render whole, never partly, and the renderer logs a `console.warn` naming the reason. The panel shows the same reason under the field as the author types; the value stays stored as typed so it can be fixed.

| Field            | Refused                                                                                                                                                                                                                                                                         | Why                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customHeadCss`  | any `<`                                                                                                                                                                                                                                                                         | It could close the `<mj-style>` or the compiled `<style>`. In a CSS string, write `\3C`.                                                            |
| `customHeadTags` | `<script>`, `<iframe>`, `<frame>`, `<frameset>`, `<object>`, `<embed>`, `<applet>`, `<svg>`, `<math>`, `<plaintext>`, `<base>`, `<form>`, `<html>`, `<head>`, `<body>`, `<mjml>` and every `<mj-*>` tag, opening or closing                                                     | Active content, document structure, or the end of the `<mj-raw>`                                                                                    |
| `customHeadTags` | an `on*` attribute                                                                                                                                                                                                                                                              | Event handlers run in browsers that show the HTML                                                                                                   |
| `customHeadTags` | a URL attribute (`href`, `src`, …) outside the editor's link schemes                                                                                                                                                                                                            | `javascript:`, `data:` and similar                                                                                                                  |
| `customHeadTags` | a `<!--` without `-->`, a tag without `>`, a `<style>`, `<title>`, `<noscript>`, `<textarea>`, `<xmp>`, `<noembed>` or `<noframes>` without its closing tag                                                                                                                     | Each would swallow the rest of the head                                                                                                             |
| `customHeadTags` | `http-equiv` other than `content-type` or `x-ua-compatible`                                                                                                                                                                                                                     | `refresh`, `set-cookie` and the like act on the page showing the email, such as a host's preview                                                    |
| `customHeadTags` | a malformed tag: `<` or `>` inside a tag (also in a quoted value: write `&lt;` / `&gt;`), a quote, `=` or backtick in an attribute name or unquoted value, attributes not separated by whitespace, anything after a closing tag's name, a self-closing `<style/>` or `<title/>` | Browsers, MJML and mail clients recover from these differently, so a tag the check reads one way could be read another way where the email is shown |

The check reads every `<` in the tags as a possible tag, inside comments and `<style>` too, so markup a browser would treat as text is held to the same rules.

`checkCustomHeadCss` and `checkCustomHeadTags` from `@templatical/types` return the verdict (`empty`, `accepted` with the trimmed value, or `refused` with a typed reason) for hosts that validate before saving. Like the settings allowlist, the check runs in the browser and in the renderer, not on your server; validate what you persist. To keep authors out of the head entirely, leave both fields out of [`templateSettings.fields`](/api/editor#restricting-the-settings-panel).

## Dark mode colors

Some mail apps restyle an email when the reader uses dark mode. Set `darkColors` on the template, a section, a title, a paragraph or a button to choose the colors used then. A field you leave out keeps its light color. In the editor, the colors sit in a **Dark Mode** group in each of those blocks' settings and in the template settings' Appearance card.

| Where                            | Field             | Replaces in dark mode                                   |
| -------------------------------- | ----------------- | ------------------------------------------------------- |
| Template (`settings.darkColors`) | `backgroundColor` | The email background                                    |
|                                  | `textColor`       | The text of every title and paragraph                   |
|                                  | `linkColor`       | Links in titles and paragraphs                          |
| Section                          | `backgroundColor` | The section's background (not applied to a hero)        |
| Title, Paragraph                 | `backgroundColor` | The block's background                                  |
|                                  | `textColor`       | The block's text, inline text colors and links included |
| Button                           | `backgroundColor` | The button's fill                                       |
|                                  | `textColor`       | The button's label                                      |

A block's own `textColor` wins over the template's, and the template's `linkColor` wins over both for links.

The template's `textColor` and `linkColor` reach titles and paragraphs only. Menus, tables, social icon labels and dividers keep their light colors, and so do countdowns, which render as an image. A section shown as a hero takes no dark background, and the Dark Mode group is hidden for it. Dark colors on a block hidden on every viewport have no effect. When the template sets a dark `backgroundColor`, check that these blocks stay readable on it, for example by giving the section that holds a menu a light dark-mode `backgroundColor`, so the menu keeps the background its text was chosen for. A `*` or `\` in a dark color is removed: neither occurs in a color, and a `/*` would comment out the rules after it.

```ts
const content = {
  settings: {
    ...settings,
    darkColors: {
      backgroundColor: "#121212",
      textColor: "#e8e8e8",
      linkColor: "#8ab4f8",
    },
  },
  blocks: [
    createButtonBlock({
      text: "Shop now",
      url: "https://example.com",
      darkColors: { backgroundColor: "#8ab4f8", textColor: "#000000" },
    }),
  ],
};
```

The renderer turns them into CSS, never into inline styles: each element gets a class named after its role and color, such as `tpl-dark-text-e8e8e8`, and one `<mj-style>` in the head holds the rules, all `!important`:

- inside `@media (prefers-color-scheme: dark)`, which Apple Mail and Outlook for Mac apply;
- scoped to `[data-ogsc]` (text) and `[data-ogsb]` (backgrounds), the attributes Outlook.com and the Outlook apps add while they recolor an email.

Outlook for Windows applies neither.

A template without dark colors renders exactly as before: no classes and no extra `<mj-style>`.

The renderer adds no `<meta name="color-scheme">` and no `color-scheme` CSS property: whether a mail app may recolor the email is your decision. Gmail's apps ignore these rules and apply their own recoloring, unless your email opts out with `<meta name="color-scheme" content="light only">` in the head. Apple Mail stops darkening an email by itself once it declares `color-scheme: light dark`, so an email that declares it should set dark colors for its backgrounds and text.

The editor's dark mode preview shows the dark colors where they are set and the light colors elsewhere. A template without any dark colors is previewed by inverting its colors instead, as some mail apps darken an email that has no dark theme.
