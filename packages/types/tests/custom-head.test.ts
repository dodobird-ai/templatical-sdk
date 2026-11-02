import { describe, expect, it } from "vitest";
import {
  CUSTOM_HEAD_ALLOWED_HTTP_EQUIV,
  CUSTOM_HEAD_FORBIDDEN_ELEMENTS,
  checkCustomHeadCss,
  checkCustomHeadTags,
} from "../src";

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
    ['<link rel="icon" href="&#106;avascript:alert(1)">', "href"],
    ['<link rel="icon" href="&#x6A;avascript:alert(1)">', "href"],
    ["<link rel=icon href=&#106;avascript:alert(1)>", "href"],
    ['<link rel="icon" href="java&#x09;script:alert(1)">', "href"],
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
      "svg",
      "math",
      "plaintext",
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

describe("checkCustomHeadTags: readers that disagree", () => {
  // Each of these was accepted by a scanner that let a quote anywhere in a tag
  // open a quoted value, or that read `<style>` content as tags only up to a
  // quote; MJML compiled every one with the `<script>` live in the head.
  it.each([
    // A quote in the middle of an unquoted value is a literal character to
    // HTML and to htmlparser2, so the meta tag ends at its first `>`.
    '<meta a=b"><script>alert(1)</script><!-- " -->',
    "<meta a=b'><script>alert(1)</script><!-- ' -->",
    // A fake tag inside <style> text opens a quote that runs past </style>.
    '<style>.a{} <x "</style></mj-raw><mj-raw><script>window.pwn=1</script></mj-raw><mj-raw><style>" >{}</style>',
    '<style><x "</style><script>alert(1)</script><style>" ></style>',
    '<title><x "</title><script>alert(1)</script><title>" ></title>',
  ])("refuses %s", (tags) => {
    expect(checkCustomHeadTags(tags).status).toBe("refused");
  });

  it("refuses the quote-in-value meta before it reaches the script", () => {
    expect(
      checkCustomHeadTags('<meta a=b"><script>alert(1)</script><!-- " -->'),
    ).toEqual({ status: "refused", refusal: { reason: "malformed-tag" } });
  });

  it.each([
    ['<style>.a{} <x "</style>" >{}</style>', "a quote in an attribute name"],
    ['<meta "a>', "a quote opening an attribute name"],
    ["<meta a<b>", "a < in an attribute name"],
    ['<meta a=b"c>', "a double quote in an unquoted value"],
    ["<meta a=b'c>", "a single quote in an unquoted value"],
    ["<meta a=b=c>", "an equals sign in an unquoted value"],
    ["<meta a=`b`>", "a backtick in an unquoted value"],
    ["<meta a=>", "an empty unquoted value"],
    ['<meta content="a<b">', "a < in a quoted value"],
    ['<meta content="a>b">', "a > in a quoted value"],
    ["<meta a=b<c>", "a < in an unquoted value"],
    ['<meta name="a"content="b">', "no space between attributes"],
    ['<meta ="a">', "a value with no attribute name"],
    ["<meta a/b>", "a stray slash"],
    ['<meta"x">', "a quote in the tag name"],
    ["<meta\u000bname=a>", "an unusual character in the tag name"],
    ["</title x>", "an attribute on a closing tag"],
    ['<meta name="a"><![CDATA[x]]>', "a CDATA section"],
    ["<style/>", "a self-closing style"],
    ["<title />", "a self-closing title"],
  ])("refuses %s as malformed-tag (%s)", (tags) => {
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "refused",
      refusal: { reason: "malformed-tag" },
    });
  });

  it.each([
    ["<style>td{}", "style"],
    ["<title>Sale", "title"],
    ["<STYLE>td{}</STYLEX>", "style"],
    ["<noscript><link rel=stylesheet href=https://x.test/a.css>", "noscript"],
    ["<textarea>", "textarea"],
  ])("refuses %s as unclosed-element %s", (tags, element) => {
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "refused",
      refusal: { reason: "unclosed-element", element },
    });
  });

  it.each(['<meta name="a"><!doctype x', "<?xml x", "<meta name=a></ x"])(
    "refuses a declaration with no `>` after it as unclosed-tag: %s",
    (tags) => {
      expect(checkCustomHeadTags(tags)).toEqual({
        status: "refused",
        refusal: { reason: "unclosed-tag" },
      });
    },
  );

  it("accepts a text-content element closed in another case", () => {
    expect(checkCustomHeadTags("<STYLE>td{}</style >")).toEqual({
      status: "accepted",
      value: "<STYLE>td{}</style >",
    });
  });

  it.each([
    [
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      "refresh",
    ],
    ['<meta http-equiv="Refresh" content="0;url=https://x.test">', "refresh"],
    ['<meta http-equiv=set-cookie content="a=b">', "set-cookie"],
    [
      '<meta http-equiv="&#114;efresh" content="0;url=https://x.test">',
      "refresh",
    ],
    [
      '<meta http-equiv="Content-Security-Policy" content="default-src *">',
      "content-security-policy",
    ],
  ])("refuses %s as forbidden-http-equiv %s", (tags, value) => {
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "refused",
      refusal: { reason: "forbidden-http-equiv", value },
    });
  });

  it("accepts the http-equiv values it lists", () => {
    expect([...CUSTOM_HEAD_ALLOWED_HTTP_EQUIV]).toEqual([
      "content-type",
      "x-ua-compatible",
    ]);
    const tags = `<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n<meta http-equiv="X-UA-Compatible" content="IE=edge">`;
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "accepted",
      value: tags,
    });
  });

  it("accepts common head snippets", () => {
    const tags = [
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="format-detection" content="telephone=no">',
      '<link href="https://fonts.googleapis.com/css2?family=Inter&amp;display=swap" rel="stylesheet" />',
      "<style>.a > b { font-family: 'Segoe UI', \"Helvetica\"; }</style>",
      OUTLOOK_DPI,
    ].join("\n");
    expect(checkCustomHeadTags(tags)).toEqual({
      status: "accepted",
      value: tags,
    });
  });
});
