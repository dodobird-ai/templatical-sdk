import { afterEach, describe, expect, it, vi } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import type { TemplateContent, TemplateSettings } from "@templatical/types";
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

  it("warns on an unclosed comment without a detail", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderToMjml(makeContent({ customHeadTags: "<!--[if mso]>" }));
    expect(warn).toHaveBeenCalledWith(
      "[Templatical] settings.customHeadTags was left out of the render: unclosed-comment.",
    );
  });
});
