// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createTitleBlock } from "@templatical/types";
import type { TitleBlock } from "@templatical/types";
import TitleToolbar from "../src/components/toolbar/TitleToolbar.vue";
import { readOptionalSize } from "../src/utils/optionalSizeInput";
import { mountEditor } from "./helpers/mount";

function mountIt(block: TitleBlock) {
  return mountEditor(TitleToolbar, {
    props: { block, fontFamilies: [{ value: "", label: "Default" }] },
  });
}

function sizeInput(wrapper: ReturnType<typeof mountIt>) {
  return wrapper.find('[data-testid="title-font-size"]');
}
function lineHeightInput(wrapper: ReturnType<typeof mountIt>) {
  return wrapper.find('[data-testid="title-line-height"]');
}
function updates(wrapper: ReturnType<typeof mountIt>): Partial<TitleBlock>[] {
  return (wrapper.emitted("update") ?? []).map(
    (args) => args[0] as Partial<TitleBlock>,
  );
}

describe("readOptionalSize", () => {
  it("reads a positive number, whole or fractional", () => {
    expect(readOptionalSize({ value: "31", badInput: false })).toEqual({
      kind: "size",
      value: 31,
    });
    expect(readOptionalSize({ value: "1.15", badInput: false })).toEqual({
      kind: "size",
      value: 1.15,
    });
  });

  it("reads an emptied field as clearing the title's own value", () => {
    expect(readOptionalSize({ value: "", badInput: false })).toEqual({
      kind: "clear",
    });
    expect(readOptionalSize({ value: "  ", badInput: false })).toEqual({
      kind: "clear",
    });
  });

  it("waits while the entry is unfinished or not a usable size", () => {
    // "1." mid-typing reports "" with badInput in Chrome; "0" is the start of
    // "0.9". Neither may overwrite the stored value.
    expect(readOptionalSize({ value: "", badInput: true })).toEqual({
      kind: "typing",
    });
    expect(readOptionalSize({ value: "0", badInput: false })).toEqual({
      kind: "typing",
    });
    expect(readOptionalSize({ value: "-3", badInput: false })).toEqual({
      kind: "typing",
    });
  });
});

describe("TitleToolbar size controls", () => {
  it("shows an empty size field with the level's size as its placeholder", () => {
    const input = sizeInput(mountIt(createTitleBlock({ level: 3 })));
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(input.attributes("placeholder")).toBe("22");
  });

  it("shows the title's own size when it sets one", () => {
    const input = sizeInput(
      mountIt(createTitleBlock({ level: 3, fontSize: 25 })),
    );
    expect((input.element as HTMLInputElement).value).toBe("25");
  });

  it("accepts any whole px size, finer than the paragraph presets", async () => {
    const wrapper = mountIt(createTitleBlock({ level: 1 }));
    const input = sizeInput(wrapper);
    expect(input.attributes("step")).toBe("1");
    await input.setValue("31");
    expect(updates(wrapper)).toEqual([{ fontSize: 31 }]);
  });

  it("emptying the size field returns the title to its level's size", async () => {
    const wrapper = mountIt(createTitleBlock({ level: 1, fontSize: 31 }));
    await sizeInput(wrapper).setValue("");
    expect(updates(wrapper)).toEqual([{ fontSize: undefined }]);
  });

  it("shows the shared line height as the line height placeholder", () => {
    const input = lineHeightInput(mountIt(createTitleBlock()));
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(input.attributes("placeholder")).toBe("1.3");
    expect(input.attributes("step")).toBe("0.05");
  });

  it("sets and clears the title's own line height", async () => {
    const wrapper = mountIt(createTitleBlock({ lineHeight: 1.6 }));
    const input = lineHeightInput(wrapper);
    expect((input.element as HTMLInputElement).value).toBe("1.6");
    await input.setValue("1.15");
    await input.setValue("");
    expect(updates(wrapper)).toEqual([
      { lineHeight: 1.15 },
      { lineHeight: undefined },
    ]);
  });
});
