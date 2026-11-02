import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createBackgroundImage,
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createTitleBlock,
  createWrapperBlock,
  hasDarkColors,
  type Block,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "../src";
import { darkColorClasses, darkColorToken } from "../src/dark-colors";

function withBlocks(
  blocks: Block[],
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  if (settings) {
    content.settings = { ...content.settings, ...settings };
  }
  return content;
}

/**
 * Every block type that can carry dark colors, with fixed ids so the
 * rendered MJML is stable, plus the shapes whose `css-class` the change
 * touches: a block hidden on mobile, a full-width button and a section with a
 * background image. The snapshot below was recorded by running this file
 * against the renderer at v0.52.1 (`packages/renderer/src` checked out from
 * c2adfc3b), before dark colors existed, so it holds the "absent =
 * unchanged" promise.
 */
function kitchenSink(): TemplateContent {
  const section = createSectionBlock({
    id: "section-1",
    columns: "2",
    styles: { padding: { top: 8, right: 8, bottom: 8, left: 8 }, backgroundColor: "#f4f4f4" },
  });
  section.children = [
    [
      createTitleBlock({ id: "title-1", content: "<p>Hello</p>", color: "#222222" }),
      createParagraphBlock({
        id: "paragraph-1",
        content: '<p>Body with <span style="color: #555555">a mark</span> and <a href="https://example.com">a link</a></p>',
      }),
    ],
    [
      createButtonBlock({ id: "button-1", text: "Go", url: "https://example.com" }),
      createImageBlock({ id: "image-1", src: "https://example.com/a.png", alt: "A" }),
    ],
  ];
  return withBlocks(
    [
      section,
      createTitleBlock({ id: "title-2", content: "<p>Top-level title</p>" }),
      createButtonBlock({ id: "button-2", text: "No link", url: "" }),
      createParagraphBlock({
        id: "paragraph-desktop-only",
        content: "<p>Desktop only</p>",
        visibility: { desktop: true, mobile: false },
      }),
      createButtonBlock({
        id: "button-full",
        text: "Full width",
        url: "https://example.com",
        width: "full",
      }),
      createSectionBlock({
        id: "section-image",
        backgroundImage: createBackgroundImage("https://example.com/bg.jpg"),
        children: [[createTitleBlock({ id: "title-3", content: "<p>Over an image</p>" })]],
      }),
    ],
    { linkColor: "#0066cc" },
  );
}

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

describe("darkColorToken", () => {
  it("drops the # of a hex color and folds case", () => {
    expect(darkColorToken("#F5F5F5")).toBe("f5f5f5");
  });

  it("trims before folding", () => {
    expect(darkColorToken("  #ABC ")).toBe("abc");
  });

  it("encodes any other color by code point, behind an x- prefix", () => {
    expect(darkColorToken("rgb(0,0,0)")).toBe("x-rgb_28_0_2c_0_2c_0_29_");
  });

  it("keeps a color keyword readable", () => {
    expect(darkColorToken("Black")).toBe("x-black");
  });

  it("never gives a keyword the token of a hex color", () => {
    expect(darkColorToken("#abcdef")).not.toBe(darkColorToken("abcdef"));
  });
});

describe("darkColorClasses", () => {
  it("is empty for a block without dark colors", () => {
    expect(darkColorClasses(createTitleBlock())).toEqual([]);
  });

  it("names a text block's background before its text", () => {
    expect(
      darkColorClasses(
        createParagraphBlock({
          darkColors: { textColor: "#eeeeee", backgroundColor: "#111111" },
        }),
      ),
    ).toEqual(["tpl-dark-bg-111111", "tpl-dark-text-eeeeee"]);
  });

  it("names a button's fill and label", () => {
    expect(
      darkColorClasses(
        createButtonBlock({
          darkColors: { backgroundColor: "#8ab4f8", textColor: "#000000" },
        }),
      ),
    ).toEqual(["tpl-dark-button-bg-8ab4f8", "tpl-dark-button-text-000000"]);
  });

  it("names a section's background", () => {
    expect(
      darkColorClasses(
        createSectionBlock({ darkColors: { backgroundColor: "#202124" } }),
      ),
    ).toEqual(["tpl-dark-section-bg-202124"]);
  });

  it("skips a cleared color", () => {
    expect(
      darkColorClasses(
        createTitleBlock({ darkColors: { textColor: "", backgroundColor: "#000" } }),
      ),
    ).toEqual(["tpl-dark-bg-000"]);
  });

  it("gives a hero section no class", () => {
    const hero = createSectionBlock({
      backgroundImage: {
        ...createBackgroundImage("https://example.com/hero.jpg"),
        naturalWidth: 1200,
        naturalHeight: 600,
      },
      hero: { height: "image", verticalAlign: "middle" },
      darkColors: { backgroundColor: "#000000" },
    });
    expect(darkColorClasses(hero)).toEqual([]);
  });

  it("gives no class to a block type without dark colors", () => {
    expect(darkColorClasses(createImageBlock())).toEqual([]);
  });
});

describe("renderToMjml without dark colors", () => {
  it("renders exactly what it rendered before dark colors existed", async () => {
    expect(await renderToMjml(kitchenSink())).toMatchSnapshot();
  });

  it("renders empty dark color objects exactly as absent ones", async () => {
    const absent = kitchenSink();
    const empty = kitchenSink();
    empty.settings.darkColors = {};
    const section = empty.blocks[0];
    if (section.type !== "section") throw new Error("fixture changed");
    section.darkColors = {};
    const title = section.children[0][0];
    if (title.type !== "title") throw new Error("fixture changed");
    title.darkColors = { textColor: "", backgroundColor: "  " };
    expect(await renderToMjml(empty)).toBe(await renderToMjml(absent));
  });

  it("emits no dark-mode CSS or class", async () => {
    const mjml = await renderToMjml(kitchenSink());
    expect(
      ["tpl-dark", "prefers-color-scheme", "data-ogsc", "data-ogsb"].filter(
        (needle) => mjml.includes(needle),
      ),
    ).toEqual([]);
  });
});

describe("renderToMjml with dark colors", () => {
  function darkSink(): TemplateContent {
    const content = kitchenSink();
    content.settings.darkColors = {
      backgroundColor: "#121212",
      textColor: "#e8e8e8",
      linkColor: "#8ab4f8",
    };
    const section = content.blocks[0];
    if (section.type !== "section") throw new Error("fixture changed");
    section.darkColors = { backgroundColor: "#1e1e1e" };
    const [title, paragraph] = section.children[0];
    if (title.type !== "title" || paragraph.type !== "paragraph") {
      throw new Error("fixture changed");
    }
    title.darkColors = { textColor: "#ffffff" };
    paragraph.darkColors = { backgroundColor: "#2a2a2a", textColor: "#ffffff" };
    const button = section.children[1][0];
    if (button.type !== "button") throw new Error("fixture changed");
    button.darkColors = { backgroundColor: "#8ab4f8", textColor: "#000000" };
    return content;
  }

  it("marks mj-body when the template sets a dark background", async () => {
    const mjml = await renderToMjml(darkSink());
    expect(mjml).toContain(
      '<mj-body width="600px" background-color="#ffffff" css-class="tpl-dark-body">',
    );
  });

  it("leaves mj-body unmarked without a template dark background", async () => {
    const content = darkSink();
    content.settings.darkColors = { textColor: "#e8e8e8" };
    const mjml = await renderToMjml(content);
    expect(mjml).toContain(
      '<mj-body width="600px" background-color="#ffffff">',
    );
  });

  it("emits one mj-style with the media query, then the Outlook rules", async () => {
    const mjml = await renderToMjml(darkSink());
    const style = `
    <mj-style>
      @media (prefers-color-scheme: dark) {
        .tpl-dark-body, .tpl-dark-body > div { background-color: #121212 !important; }
        .tpl-rich-text, .tpl-rich-text * { color: #e8e8e8 !important; }
        .tpl-dark-section-bg-1e1e1e, .tpl-dark-section-bg-1e1e1e > table { background-color: #1e1e1e !important; }
        .tpl-dark-text-ffffff, .tpl-dark-text-ffffff * { color: #ffffff !important; }
        .tpl-dark-bg-2a2a2a { background-color: #2a2a2a !important; }
        .tpl-dark-button-bg-8ab4f8 td, .tpl-dark-button-bg-8ab4f8 a, .tpl-dark-button-bg-8ab4f8 p { background-color: #8ab4f8 !important; }
        .tpl-dark-button-text-000000 a, .tpl-dark-button-text-000000 p { color: #000000 !important; }
        .tpl-rich-text a, .tpl-rich-text a * { color: #8ab4f8 !important; }
      }
      [data-ogsb] .tpl-dark-body, [data-ogsb] .tpl-dark-body > div { background-color: #121212 !important; }
      [data-ogsc] .tpl-rich-text, [data-ogsc] .tpl-rich-text * { color: #e8e8e8 !important; }
      [data-ogsb] .tpl-dark-section-bg-1e1e1e, [data-ogsb] .tpl-dark-section-bg-1e1e1e > table { background-color: #1e1e1e !important; }
      [data-ogsc] .tpl-dark-text-ffffff, [data-ogsc] .tpl-dark-text-ffffff * { color: #ffffff !important; }
      [data-ogsb] .tpl-dark-bg-2a2a2a { background-color: #2a2a2a !important; }
      [data-ogsb] .tpl-dark-button-bg-8ab4f8 td, [data-ogsb] .tpl-dark-button-bg-8ab4f8 a, [data-ogsb] .tpl-dark-button-bg-8ab4f8 p { background-color: #8ab4f8 !important; }
      [data-ogsc] .tpl-dark-button-text-000000 a, [data-ogsc] .tpl-dark-button-text-000000 p { color: #000000 !important; }
      [data-ogsc] .tpl-rich-text a, [data-ogsc] .tpl-rich-text a * { color: #8ab4f8 !important; }
    </mj-style>`;
    expect(mjml).toContain(style);
    expect(mjml.split("prefers-color-scheme").length - 1).toBe(1);
  });

  it("puts each block's classes on its own element", async () => {
    const mjml = await renderToMjml(darkSink());
    expect(
      [
        'css-class="tpl-dark-section-bg-1e1e1e"',
        'css-class="tpl-rich-text tpl-rich-text-8 tpl-dark-text-ffffff"',
        'css-class="tpl-rich-text tpl-rich-text-8 tpl-dark-bg-2a2a2a tpl-dark-text-ffffff"',
        'css-class="tpl-dark-button-bg-8ab4f8 tpl-dark-button-text-000000"',
      ].map((needle) => mjml.split(needle).length - 1),
    ).toEqual([1, 1, 1, 1]);
  });

  it("emits one rule for a color two blocks share", async () => {
    const content = withBlocks([
      createTitleBlock({ darkColors: { textColor: "#fafafa" } }),
      createParagraphBlock({
        content: "<p>Body</p>",
        darkColors: { textColor: "#FAFAFA" },
      }),
    ]);
    const mjml = await renderToMjml(content);
    expect(mjml.split("tpl-dark-text-fafafa, ").length - 1).toBe(2);
    expect(mjml.split('tpl-dark-text-fafafa"').length - 1).toBe(2);
  });

  it("keeps a full-width button's class next to its dark classes", async () => {
    const mjml = await renderToMjml(
      withBlocks([
        createButtonBlock({
          width: "full",
          darkColors: { textColor: "#000000" },
        }),
      ]),
    );
    expect(mjml).toContain(
      'css-class="tpl-button-full tpl-dark-button-text-000000"',
    );
  });

  it("emits no rule for a block hidden on every viewport", async () => {
    const mjml = await renderToMjml(
      withBlocks([
        createTitleBlock({
          visibility: { desktop: false, mobile: false },
          darkColors: { textColor: "#fafafa" },
        }),
      ]),
    );
    expect(mjml.includes("tpl-dark-text-fafafa")).toBe(false);
  });

  it("finds blocks inside a layout wrapper", async () => {
    const content = withBlocks([
      createParagraphBlock({ id: "p", content: "<p>Body</p>" }),
    ]);
    const layout = withBlocks([
      createWrapperBlock({
        children: [
          createSectionBlock({
            children: [[]],
            darkColors: { backgroundColor: "#101010" },
          }),
        ],
      }),
      createSlotBlock(),
    ]);
    const mjml = await renderToMjml(content, { layout });
    expect(mjml.split("tpl-dark-section-bg-101010").length - 1).toBe(5);
  });

  it("escapes a color that would break out of its declaration", async () => {
    const mjml = await renderToMjml(
      withBlocks([], {
        darkColors: { backgroundColor: "red; } body { display:none" },
      }),
    );
    expect(mjml).toContain(
      ".tpl-dark-body, .tpl-dark-body > div { background-color: red  body  display:none !important; }",
    );
  });

  it("drops a comment opener so later rules survive", async () => {
    const mjml = await renderToMjml(
      withBlocks(
        [createTitleBlock({ darkColors: { textColor: "#fafafa" } })],
        { darkColors: { linkColor: "red /* " } },
      ),
    );
    expect([
      mjml.includes("/*"),
      mjml.includes(
        ".tpl-rich-text a, .tpl-rich-text a * { color: red / !important; }",
      ),
      mjml.includes(
        "[data-ogsc] .tpl-dark-text-fafafa, [data-ogsc] .tpl-dark-text-fafafa * { color: #fafafa !important; }",
      ),
    ]).toEqual([false, true, true]);
  });

  it("drops a backslash escape", async () => {
    const mjml = await renderToMjml(
      withBlocks([], { darkColors: { backgroundColor: "\\2a red" } }),
    );
    expect(mjml).toContain(
      ".tpl-dark-body, .tpl-dark-body > div { background-color: 2a red !important; }",
    );
  });

  it("never emits a meta tag or a color-scheme declaration", async () => {
    const mjml = await renderToMjml(darkSink());
    // `prefers-color-scheme` is the media feature; a bare `color-scheme`
    // property would change how clients treat the email, the host's call.
    expect([
      mjml.includes("<meta"),
      /(^|[^-])color-scheme\s*:/.test(mjml),
    ]).toEqual([false, false]);
  });
});

describe("dark colors through the MJML compiler", () => {
  it("keeps the dark-mode style block in the compiled head", async () => {
    const content = withBlocks([
      createTitleBlock({ content: "<p>Hi</p>", darkColors: { textColor: "#ffffff" } }),
    ]);
    const html = await compile(await renderToMjml(content));
    expect(html).toContain(
      ".tpl-dark-text-ffffff, .tpl-dark-text-ffffff * { color: #ffffff !important; }",
    );
    expect(html).toContain(
      "[data-ogsc] .tpl-dark-text-ffffff, [data-ogsc] .tpl-dark-text-ffffff * { color: #ffffff !important; }",
    );
  });

  it("puts the classes on the elements the selectors expect", async () => {
    const section = createSectionBlock({
      darkColors: { backgroundColor: "#1e1e1e" },
    });
    section.children = [
      [
        createParagraphBlock({
          content: "<p>Body</p>",
          darkColors: { backgroundColor: "#2a2a2a" },
        }),
        createButtonBlock({
          url: "https://example.com",
          darkColors: { backgroundColor: "#8ab4f8" },
        }),
      ],
    ];
    const html = await compile(
      await renderToMjml(
        withBlocks([section], { darkColors: { backgroundColor: "#121212" } }),
      ),
    );
    // mj-body (MJML 5 puts the class on <body>), mj-section (<div>),
    // mj-text and mj-button (their outer <td>).
    expect(
      [
        /<body\s+class="tpl-dark-body"/,
        /<div\s+class="tpl-dark-section-bg-1e1e1e"/,
        /<td\s+align="left" class="tpl-rich-text tpl-rich-text-8 tpl-dark-bg-2a2a2a"/,
        /<td\s+align="center" class="tpl-dark-button-bg-8ab4f8"/,
      ].map((pattern) => pattern.test(html)),
    ).toEqual([true, true, true, true]);
  });
});

describe("hasDarkColors and the rendered email agree", () => {
  function hero(children: Block[][] = [[]]): Block {
    return createSectionBlock({
      children,
      backgroundImage: {
        ...createBackgroundImage("https://example.com/hero.jpg"),
        naturalWidth: 1200,
        naturalHeight: 600,
      },
      hero: { height: "image", verticalAlign: "middle" },
      darkColors: { backgroundColor: "#000000" },
    });
  }
  const hidden = { desktop: false, mobile: false };
  const cases: Array<[string, TemplateContent]> = [
    ["no dark colors", kitchenSink()],
    ["a title's dark text", withBlocks([createTitleBlock({ darkColors: { textColor: "#fff" } })])],
    ["a template dark link only", withBlocks([], { darkColors: { linkColor: "#8ab4f8" } })],
    ["a hero section's dark background only", withBlocks([hero()])],
    [
      "a block hidden everywhere",
      withBlocks([createTitleBlock({ visibility: hidden, darkColors: { textColor: "#fff" } })]),
    ],
    [
      "a block inside a section hidden everywhere",
      withBlocks([
        createSectionBlock({
          visibility: hidden,
          children: [[createTitleBlock({ darkColors: { textColor: "#fff" } })]],
        }),
      ]),
    ],
    [
      "a block inside a hero section",
      withBlocks([
        hero([[createTitleBlock({ darkColors: { textColor: "#fff" } })]]),
      ]),
    ],
    ["only cleared dark colors", withBlocks([createButtonBlock({ darkColors: { textColor: "" } })])],
  ];

  it.each(cases)("for %s", async (_name, content) => {
    const mjml = await renderToMjml(content);
    expect(hasDarkColors(content)).toBe(mjml.includes("prefers-color-scheme"));
  });

  it("covers both answers", async () => {
    const answers = cases.map(([, content]) => hasDarkColors(content));
    expect([answers.includes(true), answers.includes(false)]).toEqual([true, true]);
  });
});
