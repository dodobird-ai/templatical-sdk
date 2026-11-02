import { describe, expect, it } from "vitest";
import {
  createTitleBlock,
  resolveTitleFontSize,
  resolveTitleLineHeight,
  type TitleBlock,
} from "../src";

describe("resolveTitleFontSize", () => {
  it("follows the heading level when the title sets no size", () => {
    expect(resolveTitleFontSize(createTitleBlock({ level: 1 }))).toBe(36);
    expect(resolveTitleFontSize(createTitleBlock({ level: 2 }))).toBe(28);
    expect(resolveTitleFontSize(createTitleBlock({ level: 3 }))).toBe(22);
    expect(resolveTitleFontSize(createTitleBlock({ level: 4 }))).toBe(18);
  });

  it("uses the title's own size over the level's", () => {
    expect(
      resolveTitleFontSize(createTitleBlock({ level: 1, fontSize: 31 })),
    ).toBe(31);
    // Smaller than every level default: a fine-grained size, not a level.
    expect(
      resolveTitleFontSize(createTitleBlock({ level: 4, fontSize: 13 })),
    ).toBe(13);
  });

  it("ignores a size that cannot be rendered and falls back to the level", () => {
    for (const fontSize of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        resolveTitleFontSize(createTitleBlock({ level: 3, fontSize })),
      ).toBe(22);
    }
  });

  it("clamps an out-of-range level to the h2 size, as the renderer does", () => {
    // Content parsed from a JSON document is not type-checked.
    const block: TitleBlock = JSON.parse(
      JSON.stringify({ ...createTitleBlock(), level: 9 }),
    );
    expect(resolveTitleFontSize(block)).toBe(28);
  });
});

describe("resolveTitleLineHeight", () => {
  it("is the shared 1.3 when the title sets none", () => {
    expect(resolveTitleLineHeight(createTitleBlock())).toBe(1.3);
  });

  it("uses the title's own line height", () => {
    expect(resolveTitleLineHeight(createTitleBlock({ lineHeight: 1.15 }))).toBe(
      1.15,
    );
  });

  it("ignores a line height that cannot be rendered", () => {
    for (const lineHeight of [0, -1, Number.NaN]) {
      expect(resolveTitleLineHeight(createTitleBlock({ lineHeight }))).toBe(
        1.3,
      );
    }
  });
});

describe("createTitleBlock", () => {
  it("leaves size and line height absent so the level decides", () => {
    const block = createTitleBlock();
    expect("fontSize" in block).toBe(false);
    expect("lineHeight" in block).toBe(false);
  });
});
