import { describe, expect, it } from "vitest";
import {
  CUSTOM_HEAD_FORBIDDEN_ELEMENTS,
  checkCustomHeadCss,
  checkCustomHeadTags,
} from "../src";
import { getTagAttrNames } from "../src/html-scan";

const OUTLOOK_DPI = `<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->`;

describe("checkCustomHeadCss", () => {
  it.each([undefined, "", "   ", "\n\t "])("reads %j as empty", (css) => {
    expect(checkCustomHeadCss(css)).toEqual({ status: "empty" });
  });

  it("accepts CSS and trims it", () => {
    expect(
      checkCustomHeadCss(
        "\n  .footer a { color: #666666; }\n  @media (max-width: 480px) { .hero { padding: 0; } }  ",
      ),
    ).toEqual({
      status: "accepted",
      value:
        ".footer a { color: #666666; }\n  @media (max-width: 480px) { .hero { padding: 0; } }",
    });
  });

  it("accepts a CSS escape for a less-than sign", () => {
    expect(checkCustomHeadCss('.x::before { content: "\\3C"; }')).toEqual({
      status: "accepted",
      value: '.x::before { content: "\\3C"; }',
    });
  });

  it.each([
    ".a { color: red; }</mj-style><mj-raw><script>alert(1)</script></mj-raw>",
    ".a { color: red; }</style><script>alert(1)</script>",
    '.a::before { content: "<"; }',
  ])("refuses CSS containing `<`: %s", (css) => {
    expect(checkCustomHeadCss(css)).toEqual({
      status: "refused",
      refusal: { reason: "markup-in-css" },
    });
  });
});

describe("checkCustomHeadTags", () => {
  it.each([undefined, "", "  \n "])("reads %j as empty", (tags) => {
    expect(checkCustomHeadTags(tags)).toEqual({ status: "empty" });
  });

  it("accepts head tags and an Outlook conditional comment, trimmed", () => {
    const tags = `<meta name="x-apple-disable-message-reformatting">\n<link rel="preconnect" href="https://fonts.gstatic.com">\n${OUTLOOK_DPI}`;
    expect(checkCustomHeadTags(`  ${tags}\n`)).toEqual({
      status: "accepted",
      value: tags,
    });
  });

  it("accepts a downlevel-revealed conditional comment", () => {
    const tags = `<!--[if !mso]><!--><meta name="x-not-outlook" content="1"><!--<![endif]-->`;
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "accepted",
      value: tags,
    });
  });

  it("accepts a style element and text with a bare `<`", () => {
    const tags = `<style>td { font-family: 'Segoe UI', Arial, sans-serif; }</style><title>a < b</title>`;
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "accepted",
      value: tags,
    });
  });

  it.each([
    ["<script>alert(1)</script>", "script"],
    ["<SCRIPT src=https://x.test/a.js></SCRIPT>", "script"],
    ['<meta name="a"><script/x>alert(1)</script>', "script"],
    [`<!--[if mso]><script>alert(1)</script><![endif]-->`, "script"],
    ['<iframe src="https://x.test"></iframe>', "iframe"],
    ['<base href="https://x.test/">', "base"],
    ["<body>", "body"],
    ["</head><body>", "head"],
    ["</mjml>", "mjml"],
    ['<meta name="a"></mj-raw><mj-text>x</mj-text>', "mj-raw"],
    ["<mj-style>.a{}</mj-style>", "mj-style"],
    ["</MJ-HEAD>", "mj-head"],
  ])("refuses %s as forbidden-element %s", (tags, element) => {
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "refused",
      refusal: { reason: "forbidden-element", element },
    });
  });

  it.each([
    [
      '<link rel="stylesheet" href="https://x.test/a.css" onload="alert(1)">',
      "onload",
    ],
    ["<meta ONERROR=alert(1)>", "onerror"],
    ['<style onload="x">a{}</style>', "onload"],
  ])("refuses %s as event-handler %s", (tags, attribute) => {
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "refused",
      refusal: { reason: "event-handler", attribute },
    });
  });

  it("does not read an on-word inside a quoted value as an attribute", () => {
    const tags = `<meta name="description" content="Sale on now onload=1">`;
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "accepted",
      value: tags,
    });
  });

  it.each([
    ['<link rel="stylesheet" href="javascript:alert(1)">', "href"],
    ['<link rel="icon" href=" JavaScript:alert(1)">', "href"],
    ['<link rel="stylesheet" href="data:text/css,a{}">', "href"],
  ])("refuses %s as unsafe-url %s", (tags, attribute) => {
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "refused",
      refusal: { reason: "unsafe-url", attribute },
    });
  });

  it.each(["<!--[if mso]><style>td{}</style>", '<meta name="a"><!-- note'])(
    "refuses an unclosed comment: %s",
    (tags) => {
      expect(checkCustomHeadTags(tags)).toEqual({
        status: "refused",
        refusal: { reason: "unclosed-comment" },
      });
    },
  );

  it("treats `<!-->` as a closed comment, as HTML does", () => {
    expect(checkCustomHeadTags('<!--><meta name="a">')).toEqual({
      status: "accepted",
      value: '<!--><meta name="a">',
    });
  });

  it.each(['<meta name="a"', '<meta content="unterminated>'])(
    "refuses an unclosed tag: %s",
    (tags) => {
      expect(checkCustomHeadTags(tags)).toEqual({
        status: "refused",
        refusal: { reason: "unclosed-tag" },
      });
    },
  );

  it("names every forbidden element it documents", () => {
    expect([...CUSTOM_HEAD_FORBIDDEN_ELEMENTS]).toEqual([
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
    for (const element of CUSTOM_HEAD_FORBIDDEN_ELEMENTS) {
      expect(checkCustomHeadTags(`<${element}>`)).toEqual({
        status: "refused",
        refusal: { reason: "forbidden-element", element },
      });
    }
  });
});

describe("getTagAttrNames", () => {
  it("lists names in order, lower-cased, skipping values", () => {
    expect(
      getTagAttrNames(` name="a b" Content='x onload=1' hidden data-x=y /`),
    ).toEqual(["name", "content", "hidden", "data-x"]);
  });

  it("stops at an unterminated quoted value", () => {
    expect(getTagAttrNames(` rel="x onload=1`)).toEqual(["rel"]);
  });

  it("returns no names for an empty attribute string", () => {
    expect(getTagAttrNames("")).toEqual([]);
  });
});
