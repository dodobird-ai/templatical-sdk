import { findOpenTagEnd, getTagAttrNames, getTagAttrValue } from "./html-scan";
import { isSafeUrlAttribute } from "./url-policy";

/**
 * Elements a template's custom head tags may not contain.
 *
 * - `script`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`:
 *   run or load active content. The editor's own export preview renders the
 *   compiled HTML, and a host may show it in a webmail-style viewer, so author
 *   content must never be able to execute there.
 * - `base`: rewrites every relative URL in the email.
 * - `form`: has no place in a head and is a phishing primitive.
 * - `html`, `head`, `body`, `mjml`, and every `mj-*` element: the tags are
 *   emitted inside `<mj-raw>` in `<mj-head>`, so these either close that
 *   context early (`</mj-raw>`, `</mj-head>`, `</mjml>` make the MJML
 *   compiler throw "Malformed MJML") or restructure the document.
 */
export const CUSTOM_HEAD_FORBIDDEN_ELEMENTS: readonly string[] = Object.freeze([
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "base",
  "form",
  "html",
  "head",
  "body",
  "mjml",
]);

/** Why a custom head value is left out of the rendered email. */
export type CustomHeadRefusal =
  /** The CSS contains `<`, which could close the `<mj-style>` or `<style>` it is emitted in. */
  | { readonly reason: "markup-in-css" }
  /** The tags contain an element from {@link CUSTOM_HEAD_FORBIDDEN_ELEMENTS}, or an `mj-*` element. */
  | { readonly reason: "forbidden-element"; readonly element: string }
  /** A tag carries an `on*` event-handler attribute. */
  | { readonly reason: "event-handler"; readonly attribute: string }
  /** A URL attribute uses a scheme outside the editor's link policy (`javascript:`, `data:`, …). */
  | { readonly reason: "unsafe-url"; readonly attribute: string }
  /** A `<!--` is never closed by `-->`, which would comment out the rest of the head. */
  | { readonly reason: "unclosed-comment" }
  /** A tag is never closed by `>`. */
  | { readonly reason: "unclosed-tag" };

/** The verdict on one custom head value (`customHeadCss` or `customHeadTags`). */
export type CustomHeadCheck =
  /** Unset, empty or whitespace only: nothing is rendered. */
  | { readonly status: "empty" }
  /** Rendered as `value` (the input, trimmed). */
  | { readonly status: "accepted"; readonly value: string }
  /** Left out of the render whole, never partly: a partial strip would emit CSS or markup the author did not write. */
  | { readonly status: "refused"; readonly refusal: CustomHeadRefusal };

const EMPTY: CustomHeadCheck = Object.freeze({ status: "empty" });

function refused(refusal: CustomHeadRefusal): CustomHeadCheck {
  return { status: "refused", refusal };
}

/**
 * Check `settings.customHeadCss` before it is emitted inside `<mj-style>`.
 *
 * CSS never needs a literal `<` (in a string, write `\3C`), and without one
 * the value cannot close the `<mj-style>` it sits in nor the `<style>` the
 * MJML compiler turns it into. Nothing else is inspected: what the CSS says is
 * the author's business.
 */
export function checkCustomHeadCss(css: string | undefined): CustomHeadCheck {
  const value = css?.trim() ?? "";
  if (value === "") return EMPTY;
  if (value.includes("<")) return refused({ reason: "markup-in-css" });
  return { status: "accepted", value };
}

function isTagNameStart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z]/.test(char);
}

function isTagNameChar(char: string): boolean {
  return /[A-Za-z0-9:_.-]/.test(char);
}

/** The first `<!--` with no `-->` after it, as an HTML parser reads comments. */
function hasUnclosedComment(html: string): boolean {
  let from = 0;
  for (;;) {
    const open = html.indexOf("<!--", from);
    if (open === -1) return false;
    // From open + 2, so `<!-->` and `<!--->` close themselves, as in HTML.
    const close = html.indexOf("-->", open + 2);
    if (close === -1) return true;
    from = close + 3;
  }
}

/**
 * Check `settings.customHeadTags` before it is emitted inside `<mj-raw>` in
 * `<mj-head>`.
 *
 * Accepts what a head is for — `<meta>`, `<link>`, `<style>`, `<title>` — and
 * Outlook conditional comments (`<!--[if mso]>…<![endif]-->`), whose markup
 * (`<xml>`, `<o:OfficeDocumentSettings>`) is checked like any other tag.
 * Refuses, whole: a forbidden or `mj-*` element (opening or closing), an
 * `on*` attribute, a URL attribute outside the editor's link policy, and a
 * comment or tag that never closes. A conditional comment must sit here, not
 * in the CSS: the MJML compiler strips bare head comments but keeps
 * `<mj-raw>` content.
 *
 * A forward-only scan, so a hostile value costs linear time.
 */
export function checkCustomHeadTags(tags: string | undefined): CustomHeadCheck {
  const value = tags?.trim() ?? "";
  if (value === "") return EMPTY;
  if (hasUnclosedComment(value)) return refused({ reason: "unclosed-comment" });

  let i = value.indexOf("<");
  while (i !== -1) {
    const closing = value[i + 1] === "/";
    const nameStart = closing ? i + 2 : i + 1;
    if (!isTagNameStart(value[nameStart])) {
      i = value.indexOf("<", i + 1);
      continue;
    }
    let nameEnd = nameStart;
    while (nameEnd < value.length && isTagNameChar(value[nameEnd])) nameEnd++;
    const element = value.substring(nameStart, nameEnd).toLowerCase();
    if (
      CUSTOM_HEAD_FORBIDDEN_ELEMENTS.includes(element) ||
      element.startsWith("mj-")
    ) {
      return refused({ reason: "forbidden-element", element });
    }

    const tagEnd = findOpenTagEnd(value, nameEnd);
    if (tagEnd === -1) return refused({ reason: "unclosed-tag" });
    if (!closing) {
      const attrs = value.substring(nameEnd, tagEnd);
      for (const attribute of getTagAttrNames(attrs)) {
        if (attribute.startsWith("on")) {
          return refused({ reason: "event-handler", attribute });
        }
        const attrValue = getTagAttrValue(attrs, attribute);
        if (attrValue !== null && !isSafeUrlAttribute(attribute, attrValue)) {
          return refused({ reason: "unsafe-url", attribute });
        }
      }
    }
    i = value.indexOf("<", tagEnd + 1);
  }

  return { status: "accepted", value };
}
