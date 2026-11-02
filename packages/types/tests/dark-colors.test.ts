import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
  createWrapperBlock,
  hasDarkColors,
  isDarkColorSet,
} from "../src";
import type { Block, TemplateContent } from "../src";

function content(blocks: Block[]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

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
