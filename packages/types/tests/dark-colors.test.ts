import { describe, expect, it } from "vitest";
import {
  canHaveDarkColors,
  createBackgroundImage,
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
  createWrapperBlock,
  darkColorSources,
  hasDarkColors,
  isDarkColorSet,
} from "../src";
import type { Block, SectionBlock, TemplateContent } from "../src";

function content(blocks: Block[]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

/** A one-column section with an image and a hero, so the hero applies. */
function heroSection(id: string): SectionBlock {
  return createSectionBlock({
    id,
    hero: { height: "image", verticalAlign: "middle" },
    backgroundImage: {
      ...createBackgroundImage("https://example.com/hero.jpg"),
      naturalWidth: 1200,
      naturalHeight: 600,
    },
    darkColors: { backgroundColor: "#000000" },
  });
}

const hiddenEverywhere = { desktop: false, mobile: false };

describe("isDarkColorSet", () => {
  it("is true for a color", () => {
    expect(isDarkColorSet("#111111")).toBe(true);
  });

  it("is false for undefined, empty and whitespace-only values", () => {
    expect([undefined, "", "   "].map(isDarkColorSet)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("hasDarkColors", () => {
  it("is false for a template without any dark colors", () => {
    expect(
      hasDarkColors(content([createTitleBlock(), createParagraphBlock()])),
    ).toBe(false);
  });

  it("is false when every dark color is cleared", () => {
    const doc = content([
      createTitleBlock({ darkColors: { textColor: "", backgroundColor: " " } }),
    ]);
    doc.settings.darkColors = { backgroundColor: "" };
    expect(hasDarkColors(doc)).toBe(false);
  });

  it("is true for a template-level dark color", () => {
    const doc = content([]);
    doc.settings.darkColors = { linkColor: "#8ab4f8" };
    expect(hasDarkColors(doc)).toBe(true);
  });

  it("is true for a top-level block's dark color", () => {
    expect(
      hasDarkColors(
        content([createButtonBlock({ darkColors: { textColor: "#000000" } })]),
      ),
    ).toBe(true);
  });

  it("finds a dark color on a block inside a section column", () => {
    const section = createSectionBlock({ columns: "2" });
    section.children = [
      [createImageBlock()],
      [createParagraphBlock({ darkColors: { textColor: "#eeeeee" } })],
    ];
    expect(hasDarkColors(content([section]))).toBe(true);
  });

  it("finds a dark color on a block inside a layout wrapper", () => {
    const wrapper = createWrapperBlock();
    wrapper.children = [
      createSectionBlock({ darkColors: { backgroundColor: "#000000" } }),
    ];
    expect(hasDarkColors(content([wrapper]))).toBe(true);
  });
});

describe("canHaveDarkColors", () => {
  it("is true for the four block types that carry dark colors", () => {
    expect(
      [
        createSectionBlock(),
        createTitleBlock(),
        createParagraphBlock(),
        createButtonBlock(),
      ].map(canHaveDarkColors),
    ).toEqual([true, true, true, true]);
  });

  it("is false for an image", () => {
    expect(canHaveDarkColors(createImageBlock())).toBe(false);
  });

  it("is false for a section shown as a hero", () => {
    expect(canHaveDarkColors(heroSection("hero"))).toBe(false);
  });
});

describe("darkColorSources", () => {
  it("lists the blocks that set dark colors, in document order", () => {
    const section = createSectionBlock({
      id: "s",
      darkColors: { backgroundColor: "#111111" },
    });
    section.children = [
      [createTitleBlock({ id: "t", darkColors: { textColor: "#eeeeee" } })],
    ];
    const ids = darkColorSources([
      section,
      createParagraphBlock({ id: "plain" }),
      createButtonBlock({ id: "b", darkColors: { textColor: "#000000" } }),
    ]).map((block) => block.id);
    expect(ids).toEqual(["s", "t", "b"]);
  });

  it("skips a hero section but keeps the blocks inside it", () => {
    const hero = heroSection("hero");
    hero.children = [
      [createTitleBlock({ id: "inside", darkColors: { textColor: "#fff" } })],
    ];
    expect(darkColorSources([hero]).map((block) => block.id)).toEqual([
      "inside",
    ]);
  });

  it("skips a block hidden on every viewport, children included", () => {
    const section = createSectionBlock({
      id: "hidden",
      visibility: hiddenEverywhere,
      darkColors: { backgroundColor: "#111111" },
    });
    section.children = [
      [createTitleBlock({ id: "inside", darkColors: { textColor: "#fff" } })],
    ];
    expect(darkColorSources([section])).toEqual([]);
  });

  it("keeps a block hidden on one viewport only", () => {
    const title = createTitleBlock({
      id: "mobile-only",
      visibility: { desktop: false, mobile: true },
      darkColors: { textColor: "#fff" },
    });
    expect(darkColorSources([title]).map((block) => block.id)).toEqual([
      "mobile-only",
    ]);
  });
});

describe("hasDarkColors and the email agree", () => {
  it("is false when the only dark color is on a hero section", () => {
    expect(hasDarkColors(content([heroSection("hero")]))).toBe(false);
  });

  it("is false when the only dark color is on a block hidden everywhere", () => {
    expect(
      hasDarkColors(
        content([
          createTitleBlock({
            visibility: hiddenEverywhere,
            darkColors: { textColor: "#ffffff" },
          }),
        ]),
      ),
    ).toBe(false);
  });
});
