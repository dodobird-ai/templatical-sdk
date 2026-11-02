import type { Block, TemplateDarkColors } from "@templatical/types";
import {
  isDarkColorSet,
  isSection,
  isWrapper,
  resolveHero,
} from "@templatical/types";
import { escapeCssValue } from "./escape";
import { RICH_TEXT_CSS_CLASS } from "./rich-text";
import { isHiddenOnAll } from "./visibility";

/**
 * Dark colors become CSS, never inline styles: a mail client in dark mode
 * applies `@media (prefers-color-scheme: dark)` (Apple Mail, iOS Mail, Outlook
 * for Mac) or, in Outlook.com and the Outlook apps, rules scoped to the
 * `[data-ogsc]` (text) and `[data-ogsb]` (background) attributes it adds while
 * recoloring. Each rule is `!important` because it has to beat the light
 * color MJML writes inline.
 *
 * Each element carrying a dark color gets a class naming the role and the
 * color, e.g. `tpl-dark-text-f5f5f5`. Blocks sharing a color share the class
 * and its rule, and a block's classes follow from the block alone, so the
 * renderers need no state passed down.
 *
 * Nothing here emits a `<meta name="color-scheme">` or a `color-scheme`
 * property: whether a client may recolor the email is the host's decision.
 */

/** Marks `mj-body` when the template sets a dark background. */
export const DARK_BODY_CSS_CLASS = "tpl-dark-body";

/** What a dark color paints, which decides the selectors that reach it. */
type DarkColorRole =
  "body-bg" | "section-bg" | "text-bg" | "text" | "button-bg" | "button-text";

type CssProperty = "background-color" | "color";

const ROLE_PROPERTY: Record<DarkColorRole, CssProperty> = {
  "body-bg": "background-color",
  "section-bg": "background-color",
  "text-bg": "background-color",
  text: "color",
  "button-bg": "background-color",
  "button-text": "color",
};

const ROLE_CLASS_PREFIX: Record<Exclude<DarkColorRole, "body-bg">, string> = {
  "section-bg": "tpl-dark-section-bg",
  "text-bg": "tpl-dark-bg",
  text: "tpl-dark-text",
  "button-bg": "tpl-dark-button-bg",
  "button-text": "tpl-dark-button-text",
};

/**
 * The elements MJML writes the light color on, relative to the element that
 * carries the `css-class`:
 *
 * - `mj-body` puts the class on `<body>` (MJML 5) or on the wrapping `<div>`
 *   (MJML 4) and the color on both.
 * - `mj-section` puts it on its `<div>` and the color on that div and on the
 *   `<table>` directly inside it.
 * - `mj-text` puts it on the `<td>` holding the container background; the
 *   text color sits on the `<div>` inside, and on any inline mark.
 * - `mj-button` puts it on the outer `<td>`; the fill is on the inner `<td>`
 *   and on the `<a>` (a `<p>` when the button has no link), the label color
 *   on that `<a>`/`<p>`.
 */
const ROLE_SELECTORS: Record<DarkColorRole, (scope: string) => string[]> = {
  "body-bg": (scope) => [scope, `${scope} > div`],
  "section-bg": (scope) => [scope, `${scope} > table`],
  "text-bg": (scope) => [scope],
  text: (scope) => [scope, `${scope} *`],
  "button-bg": (scope) => [`${scope} td`, `${scope} a`, `${scope} p`],
  "button-text": (scope) => [`${scope} a`, `${scope} p`],
};

/** Outlook marks recolored text with `data-ogsc`, backgrounds with `data-ogsb`. */
const OUTLOOK_ATTRIBUTE: Record<CssProperty, string> = {
  "background-color": "[data-ogsb]",
  color: "[data-ogsc]",
};

interface DarkColorRule {
  selectors: string[];
  property: CssProperty;
  value: string;
}

interface DarkColorTarget {
  role: Exclude<DarkColorRole, "body-bg">;
  color: string;
}

/**
 * A color as a class-name segment. A hex color drops its `#`
 * (`#F5F5F5` → `f5f5f5`); anything else is prefixed `x-` and every character
 * outside `[a-z0-9]` is written as its code point (`rgb(0,0,0)` →
 * `x-rgb_28_0_2c_0_2c_0_29_`), so two different colors never share a class.
 * Colors are case-insensitive in CSS, so case is folded first.
 */
export function darkColorToken(color: string): string {
  const folded = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(folded);
  if (hex) {
    return hex[1];
  }
  const encoded = Array.from(folded, (char) =>
    /[a-z0-9]/.test(char)
      ? char
      : `_${(char.codePointAt(0) ?? 0).toString(16)}_`,
  ).join("");
  return `x-${encoded}`;
}

function roleClass(target: DarkColorTarget): string {
  return `${ROLE_CLASS_PREFIX[target.role]}-${darkColorToken(target.color)}`;
}

function target(
  role: DarkColorTarget["role"],
  color: string | undefined,
): DarkColorTarget[] {
  return isDarkColorSet(color) ? [{ role, color: color.trim() }] : [];
}

/** The dark colors a block paints, in a fixed role order. */
function darkColorTargets(block: Block): DarkColorTarget[] {
  switch (block.type) {
    case "title":
    case "paragraph":
      return [
        ...target("text-bg", block.darkColors?.backgroundColor),
        ...target("text", block.darkColors?.textColor),
      ];
    case "button":
      return [
        ...target("button-bg", block.darkColors?.backgroundColor),
        ...target("button-text", block.darkColors?.textColor),
      ];
    case "section":
      // A hero paints its image over the whole box, and mj-hero's markup has
      // no element the section selectors reach.
      return resolveHero(block)?.applied
        ? []
        : target("section-bg", block.darkColors?.backgroundColor);
    default:
      return [];
  }
}

/**
 * The classes a block's MJML element takes for its dark colors: none when it
 * sets none, so a template without dark colors renders exactly as before.
 */
export function darkColorClasses(block: Block): string[] {
  return darkColorTargets(block).map(roleClass);
}

function collectTargets(blocks: Block[], out: DarkColorTarget[]): void {
  for (const block of blocks) {
    if (isHiddenOnAll(block)) {
      continue;
    }
    out.push(...darkColorTargets(block));
    if (isSection(block)) {
      for (const column of block.children) {
        collectTargets(column, out);
      }
    } else if (isWrapper(block)) {
      collectTargets(block.children, out);
    }
  }
}

function rule(
  role: DarkColorRole,
  scope: string,
  color: string,
): DarkColorRule {
  return {
    selectors: ROLE_SELECTORS[role](scope),
    property: ROLE_PROPERTY[role],
    value: escapeCssValue(color.trim()),
  };
}

/**
 * Template rules first, block rules after: a block's text rule has the same
 * specificity as the template's (one class), so source order lets the block
 * win. The template's link rule adds a type selector, so it wins over both
 * for links.
 */
function darkColorRules(
  settings: TemplateDarkColors | undefined,
  blocks: Block[],
): DarkColorRule[] {
  const richText = `.${RICH_TEXT_CSS_CLASS}`;
  const rules: DarkColorRule[] = [];

  if (isDarkColorSet(settings?.backgroundColor)) {
    rules.push(
      rule("body-bg", `.${DARK_BODY_CSS_CLASS}`, settings.backgroundColor),
    );
  }
  if (isDarkColorSet(settings?.textColor)) {
    rules.push(rule("text", richText, settings.textColor));
  }

  const targets: DarkColorTarget[] = [];
  collectTargets(blocks, targets);
  const seen = new Set<string>();
  for (const entry of targets) {
    const className = roleClass(entry);
    if (seen.has(className)) {
      continue;
    }
    seen.add(className);
    rules.push(rule(entry.role, `.${className}`, entry.color));
  }

  if (isDarkColorSet(settings?.linkColor)) {
    rules.push({
      selectors: [`${richText} a`, `${richText} a *`],
      property: "color",
      value: escapeCssValue(settings.linkColor.trim()),
    });
  }

  return rules;
}

function declaration(entry: DarkColorRule, prefix: string): string {
  const selectors = entry.selectors
    .map((selector) => `${prefix}${selector}`)
    .join(", ");
  return `${selectors} { ${entry.property}: ${entry.value} !important; }`;
}

/**
 * The `<mj-style>` holding every dark-mode rule of the template, or `""` when
 * neither the template nor any block sets a dark color.
 *
 * Not `inline="inline"`: juice would copy the `[data-og*]` rules onto
 * elements, where they would apply in light mode too.
 */
export function renderDarkColorStyle(
  settings: TemplateDarkColors | undefined,
  blocks: Block[],
): string {
  const rules = darkColorRules(settings, blocks);
  if (rules.length === 0) {
    return "";
  }

  const indent = "\n      ";
  const media = rules
    .map((entry) => declaration(entry, ""))
    .join(`${indent}  `);
  const outlook = rules
    .map((entry) => declaration(entry, `${OUTLOOK_ATTRIBUTE[entry.property]} `))
    .join(indent);

  return `\n    <mj-style>${indent}@media (prefers-color-scheme: dark) {${indent}  ${media}${indent}}${indent}${outlook}\n    </mj-style>`;
}

/** ` css-class="tpl-dark-body"` for `mj-body` when the template sets a dark background. */
export function darkBodyClassAttr(
  settings: TemplateDarkColors | undefined,
): string {
  return isDarkColorSet(settings?.backgroundColor)
    ? ` css-class="${DARK_BODY_CSS_CLASS}"`
    : "";
}
