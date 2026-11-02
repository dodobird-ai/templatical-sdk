import { afterEach, describe, expect, it, vi } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import {
  checkCustomHeadTags,
  type TemplateContent,
  type TemplateSettings,
} from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * Custom head: `settings.customHeadTags` lands in an `<mj-raw>` and
 * `settings.customHeadCss` in an `<mj-style>`, last in `<mj-head>`. Checked
 * against the real MJML compiler with `keepComments: false`, the setting that
 * strips a bare head comment — so an Outlook conditional survives only
 * because it sits inside `<mj-raw>`.
 */

const OUTLOOK_DPI = `<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->`;
const META = `<meta name="x-apple-disable-message-reformatting">`;
const CSS = `.custom-footer a { color: #777777 !important; }`;

function makeContent(
  settings: Partial<TemplateSettings> = {},
): TemplateContent {
  const content = createDefaultTemplateContent();
  return {
    blocks: [createParagraphBlock({ content: "<p>Hello</p>" })],
    settings: { ...content.settings, ...settings },
  };
}

function headOf(mjml: string): string {
  return mjml.slice(mjml.indexOf("<mj-head>"), mjml.indexOf("</mj-head>"));
}

async function compiledHead(mjml: string): Promise<string> {
  const result = await mjml2html(mjml, { keepComments: false });
  expect(result.errors).toEqual([]);
  return result.html.slice(0, result.html.indexOf("</head>"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("custom head — absent", () => {
  it.each([
    ["undefined", { customHeadCss: undefined, customHeadTags: undefined }],
    ["empty", { customHeadCss: "", customHeadTags: "" }],
    ["blank", { customHeadCss: "  \n ", customHeadTags: "\t\n" }],
  ])(
    "renders byte for byte as a template without the fields when %s",
    async (_label, settings) => {
      const without = await renderToMjml(makeContent());
      expect(await renderToMjml(makeContent(settings))).toBe(without);
    },
  );

  // The cases above compare the renderer with itself. That output is unchanged
  // from before custom head existed is pinned by the snapshot in
  // locale.test.ts ("preserves the current single-language output"); this one
  // pins the seam itself: nothing, not even whitespace, between the built-in
  // stylesheets and </mj-head>.
  it("closes mj-head right after the built-in stylesheets", async () => {
    const mjml = await renderToMjml(makeContent());
    expect(mjml).toContain(".tpl-hide-desktop");
    expect(mjml).toMatch(
      /\.tpl-hide-desktop[^<]*\n {4}<\/mj-style>\n {2}<\/mj-head>/,
    );
  });

  it("adds no mj-raw to the head of a template without a custom head", async () => {
    const head = headOf(await renderToMjml(makeContent()));
    expect(head).not.toContain("<mj-raw>");
    // The head still ends on the built-in visibility stylesheet.
    expect(head.trimEnd().endsWith("</mj-style>")).toBe(true);
    expect(head).toContain(".tpl-hide-desktop");
  });
});

describe("custom head — accepted", () => {
  it("emits the tags in an mj-raw and the CSS in an mj-style, last in mj-head", async () => {
    const mjml = await renderToMjml(
      makeContent({
        customHeadTags: `  ${META}\n${OUTLOOK_DPI}\n`,
        customHeadCss: `\n${CSS}\n`,
      }),
    );
    expect(mjml).toContain(
      `    </mj-style>\n    <mj-raw>\n${META}\n${OUTLOOK_DPI}\n    </mj-raw>\n    <mj-style>\n${CSS}\n    </mj-style>\n  </mj-head>`,
    );
  });

  it("emits only the CSS when no tags are set", async () => {
    const head = headOf(
      await renderToMjml(makeContent({ customHeadCss: CSS })),
    );
    expect(head).not.toContain("<mj-raw>");
    expect(head.trimEnd().endsWith(`<mj-style>\n${CSS}\n    </mj-style>`)).toBe(
      true,
    );
  });

  it("reaches the compiled head: the meta, the Outlook conditional and the CSS", async () => {
    const head = await compiledHead(
      await renderToMjml(
        makeContent({
          customHeadTags: `${META}\n${OUTLOOK_DPI}`,
          customHeadCss: CSS,
        }),
      ),
    );
    expect(head).toContain(META);
    expect(head).toContain(OUTLOOK_DPI);
    expect(head).toContain(".custom-footer a { color: #777777 !important; }");
  });

  it("puts the custom CSS after the built-in link rule", async () => {
    const head = await compiledHead(
      await renderToMjml(
        makeContent({ customHeadCss: "a { color: #ff0000; }" }),
      ),
    );
    const builtIn = head.indexOf("a { color: inherit;");
    const custom = head.indexOf("a { color: #ff0000; }");
    expect(builtIn).toBeGreaterThan(-1);
    expect(custom).toBeGreaterThan(builtIn);
  });

  it("renders a language's own custom head from its l10n layer", async () => {
    const content = makeContent({
      customHeadCss: ".lang { color: #000000; }",
      locales: ["de"],
      l10n: { de: { set: { customHeadCss: ".lang { color: #00aa00; }" } } },
    });
    expect(await renderToMjml(content)).toContain(".lang { color: #000000; }");
    const german = await renderToMjml(content, { locale: "de" });
    expect(german).toContain(".lang { color: #00aa00; }");
    expect(german).not.toContain(".lang { color: #000000; }");
  });
});

describe("custom head — refused", () => {
  it("leaves out tags with a script and warns, keeping the CSS", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mjml = await renderToMjml(
      makeContent({
        customHeadTags: `${META}<script>alert(1)</script>`,
        customHeadCss: CSS,
      }),
    );
    expect(mjml).not.toContain("<script");
    expect(mjml).not.toContain(META);
    expect(mjml).not.toContain("<mj-raw>");
    expect(mjml).toContain(`<mj-style>\n${CSS}\n    </mj-style>`);
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadTags was left out of the render: forbidden-element (<script>).",
    );
  });

  it("leaves out CSS that would close its mj-style, and the result still compiles", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mjml = await renderToMjml(
      makeContent({
        customHeadCss: ".a{}</mj-style></mj-head><mj-body></mj-body></mjml>",
      }),
    );
    expect(mjml).toBe(await renderToMjml(makeContent()));
    expect(await compiledHead(mjml)).toContain(".tpl-hide-desktop");
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadCss was left out of the render: markup-in-css.",
    );
  });

  it("leaves out tags that would close the mj-raw", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mjml = await renderToMjml(
      makeContent({ customHeadTags: `${META}</mj-raw><mj-raw>` }),
    );
    expect(mjml).toBe(await renderToMjml(makeContent()));
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadTags was left out of the render: forbidden-element (<mj-raw>).",
    );
  });

  it("names the attribute of a refused event handler", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderToMjml(
      makeContent({
        customHeadTags: `<link rel="x" href="https://a.test" onload="x()">`,
      }),
    );
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadTags was left out of the render: event-handler (onload).",
    );
  });

  it("names the refused http-equiv", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderToMjml(
      makeContent({
        customHeadTags: `<meta http-equiv="Refresh" content="0;url=https://a.test">`,
      }),
    );
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadTags was left out of the render: forbidden-http-equiv (refresh).",
    );
  });

  it("names the element that is never closed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderToMjml(makeContent({ customHeadTags: "<title>Sale" }));
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadTags was left out of the render: unclosed-element (<title>).",
    );
  });

  it("warns on an unclosed comment without a detail", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderToMjml(makeContent({ customHeadTags: "<!--[if mso]>" }));
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadTags was left out of the render: unclosed-comment.",
    );
  });
});

/**
 * `checkCustomHeadTags` is only as good as its agreement with the readers
 * downstream. These run its verdict through the real MJML compiler: whatever
 * it accepts must compile, and must not carry an active element into the HTML.
 */
describe("custom head — accepted means safe to compile", () => {
  async function compileTags(tags: string) {
    const mjml = await renderToMjml(makeContent({ customHeadTags: tags }));
    return mjml2html(mjml, { keepComments: false });
  }

  // Each of these reached the compiled HTML with a live <script> under a
  // scanner that read quotes and <style> text differently from htmlparser2.
  it.each([
    '<meta a=b"><script>alert(1)</script><!-- " -->',
    "<meta a=b'><script>alert(1)</script><!-- ' -->",
    '<style>.a{} <x "</style></mj-raw><mj-raw><script>window.pwn=1</script></mj-raw><mj-raw><style>" >{}</style>',
    '<style><x "</style><script>alert(1)</script><style>" ></style>',
    '<title><x "</title><script>alert(1)</script><title>" ></title>',
  ])("leaves %s out of the compiled HTML", async (tags) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await compileTags(tags);
    expect(result.errors).toEqual([]);
    expect(result.html.toLowerCase()).not.toContain("<script");
  });

  // These made mjml2html throw "Malformed MJML" once accepted.
  it.each(['<meta a=b"><meta c=">', "<meta name=x'><meta x='>"])(
    "leaves %s out, so the template still compiles",
    async (tags) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(checkCustomHeadTags(tags).status).toBe("refused");
      const result = await compileTags(tags);
      expect(result.errors).toEqual([]);
    },
  );

  // A seeded soup of the characters and names the readers disagree on. Most
  // samples are refused; every accepted one must compile and stay inert.
  const ATOMS = [
    "<",
    ">",
    "</",
    "/>",
    '"',
    "'",
    "=",
    " ",
    "/",
    "<!--",
    "-->",
    "<![endif]-->",
    "<!--[if mso]>",
    "meta",
    "style",
    "title",
    "noscript",
    "script",
    "mj-raw",
    "svg",
    "x",
    "a",
    "b",
    "{}",
    "onload",
    "href",
    "javascript:",
    "&#106;",
    '<meta name="a">',
    "<style>",
    "</style>",
    "<title>",
    "</title>",
    "<meta ",
    "<link ",
    " rel=",
    " content=",
    '"x"',
    "'y'",
    "<o:x>",
    "</o:x>",
    "<![CDATA[",
    "]]>",
    "<!",
    "<?",
    "<!doctype",
    "<textarea>",
    "</textarea>",
    "<xmp>",
    "<p>",
    "</p>",
    "<table>",
    "<option>",
    "<li>",
    "<br>",
    "<img src=x>",
    "\n",
    "<mj-",
    "--!>",
    "<!-->",
    "&lt;",
    "&gt;",
    "<a href=",
    "<template>",
    "</template>",
    "<html",
    "<head",
    "</head",
  ];
  function mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function sample(random: () => number): string {
    const length = 2 + Math.floor(random() * 18);
    let out = "";
    for (let n = 0; n < length; n++) {
      out += ATOMS[Math.floor(random() * ATOMS.length)];
    }
    return out;
  }

  it("compiles every accepted sample with no active element", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const random = mulberry32(20261102);
    const accepted: string[] = [];
    for (let n = 0; n < 50000 && accepted.length < 300; n++) {
      const tags = sample(random);
      // Only samples with at least one tag: text alone proves nothing.
      if (
        /<[a-z]/i.test(tags) &&
        checkCustomHeadTags(tags).status === "accepted"
      ) {
        accepted.push(tags);
      }
    }
    // Enough accepted samples to mean something, or the soup tests nothing.
    expect(accepted.length).toBe(300);
    const failures: string[] = [];
    for (const tags of accepted) {
      try {
        const result = await compileTags(tags);
        const html = result.html.toLowerCase();
        if (
          result.errors.length > 0 ||
          /<(script|svg)[\s/>]/.test(html) ||
          /<[a-z][^<>]*\son[a-z]+\s*=/.test(html)
        ) {
          failures.push(tags);
        }
      } catch {
        failures.push(tags);
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);
});
