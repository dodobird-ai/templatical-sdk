import { decodeHtmlEntities } from "./html-scan";
import { isSafeUrlAttribute } from "./url-policy";

/**
 * Elements a template's custom head tags may not contain.
 *
 * - `script`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`:
 *   run or load active content. The editor's own export preview renders the
 *   compiled HTML, and a host may show it in a webmail-style viewer, so author
 *   content must never be able to execute there.
 * - `svg`, `math`: switch the browser into foreign content, where animation
 *   elements can set a link's `href` to script, and have no use in a head.
 * - `plaintext`: turns the whole rest of the document into text; it has no
 *   closing tag.
 * - `base`: rewrites every relative URL in the email.
 * - `form`: has no place in a head and is a phishing primitive.
 * - `html`, `head`, `body`, `mjml`, and every `mj-*` element: the tags are
 *   emitted inside `<mj-raw>` in `<mj-head>`, so these either close that
 *   context early (`</mj-raw>`, `</mj-head>`, `</mjml>` make the MJML
 *   compiler throw "Malformed MJML") or restructure the document.
 */
export const CUSTOM_HEAD_FORBIDDEN_ELEMENTS = Object.freeze([
  "script",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "svg",
  "math",
  "plaintext",
  "base",
  "form",
  "html",
  "head",
  "body",
  "mjml",
] as const);

/** An element custom head tags refuse: one of the list, or any MJML element. */
export type CustomHeadForbiddenElement =
  (typeof CUSTOM_HEAD_FORBIDDEN_ELEMENTS)[number] | `mj-${string}`;

/**
 * The only `http-equiv` values a custom head `<meta>` may carry. The others
 * act on the page that shows the email: `refresh` navigates a host's preview
 * frame, `set-cookie` and `content-security-policy` change what it may do.
 */
export const CUSTOM_HEAD_ALLOWED_HTTP_EQUIV = Object.freeze([
  "content-type",
  "x-ua-compatible",
] as const);

/**
 * Elements whose content a browser or the MJML compiler reads as text up to
 * the matching closing tag (`</style`, `</title`, …). Opened and never closed,
 * one swallows the rest of the document, MJML's own head markup included.
 */
const TEXT_CONTENT_ELEMENTS: ReadonlySet<string> = new Set([
  "style",
  "title",
  "textarea",
  "xmp",
  "noscript",
  "noembed",
  "noframes",
]);

/** Why a custom head value is left out of the rendered email. */
export type CustomHeadRefusal =
  /** The CSS contains `<`, which could close the `<mj-style>` or `<style>` it is emitted in. */
  | { readonly reason: "markup-in-css" }
  /** The tags contain an element from {@link CUSTOM_HEAD_FORBIDDEN_ELEMENTS}, or an `mj-*` element. */
  | {
      readonly reason: "forbidden-element";
      readonly element: CustomHeadForbiddenElement;
    }
  /** A tag carries an `on*` event-handler attribute. */
  | { readonly reason: "event-handler"; readonly attribute: string }
  /** A URL attribute uses a scheme outside the editor's link policy (`javascript:`, `data:`, …). */
  | { readonly reason: "unsafe-url"; readonly attribute: string }
  /** An `http-equiv` outside {@link CUSTOM_HEAD_ALLOWED_HTTP_EQUIV}, lower-cased. */
  | { readonly reason: "forbidden-http-equiv"; readonly value: string }
  /** A `<!--` is never closed by `-->`, which would comment out the rest of the head. */
  | { readonly reason: "unclosed-comment" }
  /** A tag is never closed by `>`. */
  | { readonly reason: "unclosed-tag" }
  /** A `<style>`, `<title>` or other text-content element is never closed. */
  | { readonly reason: "unclosed-element"; readonly element: string }
  /**
   * A tag that HTML parsers do not all read the same way: a `<` or `>` inside
   * it, a quote, `=` or backtick in an attribute name or unquoted value, an
   * unusual character in the tag name, or anything but whitespace after a
   * closing tag's name.
   */
  | { readonly reason: "malformed-tag" };

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

function isForbiddenElement(
  element: string,
): element is CustomHeadForbiddenElement {
  return (
    CUSTOM_HEAD_FORBIDDEN_ELEMENTS.some((forbidden) => forbidden === element) ||
    element.startsWith("mj-")
  );
}

function isAllowedHttpEquiv(value: string): boolean {
  return CUSTOM_HEAD_ALLOWED_HTTP_EQUIV.some((allowed) => allowed === value);
}

function isAsciiLetter(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z]/.test(char);
}

function isWhitespace(char: string | undefined): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f"
  );
}

/** Characters that end a tag name or an attribute name, as HTML reads them. */
function endsName(char: string | undefined): boolean {
  return isWhitespace(char) || char === "/" || char === ">" || char === "=";
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

type Attribute = { readonly name: string; readonly value: string | null };

/** One tag, read from its `<` to its `>`. */
type ScannedTag =
  | {
      readonly kind: "tag";
      readonly closing: boolean;
      readonly name: string;
      readonly selfClosing: boolean;
      readonly attributes: readonly Attribute[];
      /** Index of the tag's last `>`. */
      readonly end: number;
    }
  | { readonly kind: "unclosed" }
  | { readonly kind: "malformed" };

const UNCLOSED: ScannedTag = Object.freeze({ kind: "unclosed" });
const MALFORMED: ScannedTag = Object.freeze({ kind: "malformed" });

/**
 * Read the tag whose `<` is at `start` (followed by a letter, or by `/` and a
 * letter), following the HTML tokenizer: a quote opens a value only as the
 * first character after `=`, and an unquoted value ends at whitespace or `>`.
 *
 * Anything HTML calls a parse error inside the tag is MALFORMED rather than
 * recovered from, because recovery is where readers differ — a browser, the
 * MJML compiler's htmlparser2, a mail client. Above all, a tag holds no `<`
 * and no `>` but its own last one. That is what lets {@link checkCustomHeadTags}
 * examine every `<` in the input as a possible tag: no reader can find a tag
 * inside a span this scanner stepped over.
 */
function scanTag(html: string, start: number): ScannedTag {
  const closing = html[start + 1] === "/";
  let i = closing ? start + 2 : start + 1;

  const nameStart = i;
  while (i < html.length && !endsName(html[i])) i++;
  const name = html.substring(nameStart, i).toLowerCase();
  if (!/^[a-z][a-z0-9:_.-]*$/.test(name)) return MALFORMED;
  if (i >= html.length) return UNCLOSED;

  if (closing) {
    while (isWhitespace(html[i])) i++;
    if (i >= html.length) return UNCLOSED;
    if (html[i] !== ">") return MALFORMED;
    return {
      kind: "tag",
      closing,
      name,
      selfClosing: false,
      attributes: [],
      end: i,
    };
  }

  const attributes: Attribute[] = [];
  for (;;) {
    while (isWhitespace(html[i])) i++;
    if (i >= html.length) return UNCLOSED;
    if (html[i] === ">") {
      return {
        kind: "tag",
        closing,
        name,
        selfClosing: false,
        attributes,
        end: i,
      };
    }
    if (html[i] === "/") {
      if (i + 1 >= html.length) return UNCLOSED;
      if (html[i + 1] !== ">") return MALFORMED;
      return {
        kind: "tag",
        closing,
        name,
        selfClosing: true,
        attributes,
        end: i + 1,
      };
    }

    const attrStart = i;
    while (i < html.length && !endsName(html[i])) i++;
    const attrName = html.substring(attrStart, i).toLowerCase();
    if (attrName === "" || /["'<`]/.test(attrName)) return MALFORMED;

    while (isWhitespace(html[i])) i++;
    if (html[i] !== "=") {
      attributes.push({ name: attrName, value: null });
      continue;
    }
    i++; // past `=`
    while (isWhitespace(html[i])) i++;
    if (i >= html.length) return UNCLOSED;

    const quote = html[i];
    let rawValue: string;
    if (quote === '"' || quote === "'") {
      const valueEnd = html.indexOf(quote, i + 1);
      if (valueEnd === -1) return UNCLOSED;
      rawValue = html.substring(i + 1, valueEnd);
      if (/[<>]/.test(rawValue)) return MALFORMED;
      i = valueEnd + 1;
      // HTML wants whitespace, `/` or `>` between a quoted value and the next
      // attribute; without it, readers split the attributes differently.
      if (i < html.length && !endsName(html[i])) return MALFORMED;
    } else {
      const valueStart = i;
      while (i < html.length && !isWhitespace(html[i]) && html[i] !== ">") i++;
      rawValue = html.substring(valueStart, i);
      if (rawValue === "" || /["'<=`]/.test(rawValue)) return MALFORMED;
    }
    attributes.push({ name: attrName, value: decodeHtmlEntities(rawValue) });
  }
}

/** The first rule one tag's attributes break, or `null`. */
function checkAttributes(
  attributes: readonly Attribute[],
): CustomHeadRefusal | null {
  for (const { name, value } of attributes) {
    if (name.startsWith("on")) {
      return { reason: "event-handler", attribute: name };
    }
    if (value === null) continue;
    if (!isSafeUrlAttribute(name, value)) {
      return { reason: "unsafe-url", attribute: name };
    }
    if (name === "http-equiv") {
      const httpEquiv = value.trim().toLowerCase();
      if (!isAllowedHttpEquiv(httpEquiv)) {
        return { reason: "forbidden-http-equiv", value: httpEquiv };
      }
    }
  }
  return null;
}

/**
 * A `<` that does not start a tag: text, a comment, or a declaration. Readers
 * hide `<!…>`, `<?…>` and `</…>` up to the next `>`, so one with no `>` after
 * it would hide the rest of the head, MJML's closing tags included. A CDATA
 * section is refused outright: htmlparser2 reads it as raw text up to `]]>`, a
 * browser as a comment up to `>`, and a head has no use for one. Comments are
 * checked for their `-->` before the scan.
 */
function checkDeclaration(html: string, at: number): CustomHeadRefusal | null {
  const next = html[at + 1];
  if (next !== "!" && next !== "?" && next !== "/") return null;
  if (html.startsWith("<!--", at)) return null;
  if (html.substring(at, at + 9).toUpperCase() === "<![CDATA[") {
    return { reason: "malformed-tag" };
  }
  return html.indexOf(">", at) === -1 ? { reason: "unclosed-tag" } : null;
}

/**
 * Check `settings.customHeadTags` before it is emitted inside `<mj-raw>` in
 * `<mj-head>`.
 *
 * Accepts what a head is for — `<meta>`, `<link>`, `<style>`, `<title>` — and
 * Outlook conditional comments (`<!--[if mso]>…<![endif]-->`), whose markup
 * (`<xml>`, `<o:OfficeDocumentSettings>`) is checked like any other tag.
 * Refuses, whole: a forbidden or `mj-*` element (opening or closing), an
 * `on*` attribute, a URL attribute outside the editor's link policy, an
 * `http-equiv` outside {@link CUSTOM_HEAD_ALLOWED_HTTP_EQUIV}, a comment, tag
 * or text-content element that never closes, and a malformed tag. A
 * conditional comment must sit here, not in the CSS: the MJML compiler strips
 * bare head comments but keeps `<mj-raw>` content.
 *
 * Every `<` in the value is examined as a possible tag — inside comments and
 * inside `<style>` too, where a browser reads text — and no tag the scan steps
 * over holds a `<` or `>` of its own (see `scanTag`). A reader that takes a
 * span for a comment or for text therefore finds fewer tags than this check
 * examined, never one it did not.
 *
 * A forward-only scan, so a hostile value costs linear time.
 */
export function checkCustomHeadTags(tags: string | undefined): CustomHeadCheck {
  const value = tags?.trim() ?? "";
  if (value === "") return EMPTY;
  if (hasUnclosedComment(value)) return refused({ reason: "unclosed-comment" });

  // Text-content elements opened and not yet closed, in the order opened.
  const open = new Set<string>();
  let i = value.indexOf("<");
  while (i !== -1) {
    const closing = value[i + 1] === "/";
    const nameStart = closing ? i + 2 : i + 1;
    if (!isAsciiLetter(value[nameStart])) {
      const declaration = checkDeclaration(value, i);
      if (declaration !== null) return refused(declaration);
      i = value.indexOf("<", i + 1);
      continue;
    }
    // The name first, so a forbidden element is named as such even when the
    // rest of its tag is malformed (`<script/x>`).
    let nameEnd = nameStart;
    while (nameEnd < value.length && !endsName(value[nameEnd])) nameEnd++;
    const element = value.substring(nameStart, nameEnd).toLowerCase();
    if (isForbiddenElement(element)) {
      return refused({ reason: "forbidden-element", element });
    }

    const tag = scanTag(value, i);
    if (tag.kind === "unclosed") return refused({ reason: "unclosed-tag" });
    if (tag.kind === "malformed") return refused({ reason: "malformed-tag" });
    if (tag.closing) {
      open.delete(tag.name);
    } else {
      const refusal = checkAttributes(tag.attributes);
      if (refusal !== null) return refused(refusal);
      if (TEXT_CONTENT_ELEMENTS.has(tag.name)) {
        // `<style/>` is self-closing to htmlparser2 but opens text content in
        // a browser: the two disagree on where the element ends.
        if (tag.selfClosing) return refused({ reason: "malformed-tag" });
        open.add(tag.name);
      }
    }
    i = value.indexOf("<", tag.end + 1);
  }

  const [unclosed] = open;
  if (unclosed !== undefined) {
    return refused({ reason: "unclosed-element", element: unclosed });
  }
  return { status: "accepted", value };
}
