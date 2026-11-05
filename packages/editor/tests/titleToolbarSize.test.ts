// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { DOMWrapper } from "@vue/test-utils";
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

/** The `<input>` behind a wrapper, checked rather than cast. */
function inputOf(wrapper: DOMWrapper<Element>): HTMLInputElement {
  const el = wrapper.element;
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`expected an <input>, got <${el.tagName.toLowerCase()}>`);
  }
  return el;
}

/**
 * Put the browser's view of an unfinished entry on an input: Chromium reports
 * a lone "-" as an empty value with `validity.badInput` set, which happy-dom
 * cannot produce by typing.
 */
function enterUnparseable(input: HTMLInputElement): void {
  Object.defineProperty(input, "validity", {
    configurable: true,
    value: { badInput: true },
  });
  input.value = "";
  input.dispatchEvent(new Event("input"));
}

describe("readOptionalSize", () => {
  it("reads a positive number, whole or fractional where fractions are taken", () => {
    expect(readOptionalSize({ value: "31", badInput: false }, "whole")).toEqual(
      { kind: "size", value: 31 },
    );
    expect(readOptionalSize({ value: "1.15", badInput: false }, "any")).toEqual(
      { kind: "size", value: 1.15 },
    );
  });

  it("waits on a fraction in a field of whole px", () => {
    expect(
      readOptionalSize({ value: "31.5", badInput: false }, "whole"),
    ).toEqual({ kind: "typing" });
  });

  it("reads an emptied field as clearing the title's own value", () => {
    expect(readOptionalSize({ value: "", badInput: false }, "any")).toEqual({
      kind: "clear",
    });
    expect(readOptionalSize({ value: "  ", badInput: false }, "any")).toEqual({
      kind: "clear",
    });
  });

  it("waits while the entry is unfinished or not a usable size", () => {
    // A lone "-" reports "" with badInput in Chromium; "0" is the start of
    // "0.9". Neither may overwrite the stored value.
    expect(readOptionalSize({ value: "", badInput: true }, "any")).toEqual({
      kind: "typing",
    });
    expect(readOptionalSize({ value: "0", badInput: false }, "any")).toEqual({
      kind: "typing",
    });
    expect(readOptionalSize({ value: "-3", badInput: false }, "any")).toEqual({
      kind: "typing",
    });
  });
});

describe("heading level names", () => {
  const locales = import.meta.glob<{ default: unknown }>(
    "../src/i18n/locales/*.ts",
    { eager: true },
  );

  it.each(Object.keys(locales))(
    "%s leaves the size to the size field",
    (path) => {
      expect(path).toMatch(/locales/);
      const labels = JSON.stringify(locales[path]).match(
        /"heading[1-4]":"[^"]*"/g,
      );
      expect(labels).toHaveLength(4);
      expect(labels?.filter((label) => /\dpx/.test(label))).toEqual([]);
    },
  );
});

describe("TitleToolbar size controls", () => {
  it("reads the level's size as the field's value, not a hint", () => {
    const input = sizeInput(mountIt(createTitleBlock({ level: 3 })));
    expect(input.exists()).toBe(true);
    expect(inputOf(input).value).toBe("22");
    expect(input.attributes("placeholder")).toBeUndefined();
  });

  it("picking a level drops a size set by hand, so the title takes that level's size", async () => {
    const wrapper = mountIt(createTitleBlock({ level: 1, fontSize: 31 }));
    await wrapper.find("select").setValue("3");
    // toStrictEqual: `fontSize: undefined` is what clears the size, and toEqual
    // would also accept an update that leaves it out and keeps the old size.
    expect(wrapper.emitted("update")).toStrictEqual([
      [{ level: 3, fontSize: undefined }],
    ]);
  });

  it("shows the title's own size when it sets one", () => {
    const input = sizeInput(
      mountIt(createTitleBlock({ level: 3, fontSize: 25 })),
    );
    expect(inputOf(input).value).toBe("25");
  });

  it("accepts any whole px size, finer than the paragraph presets", async () => {
    const wrapper = mountIt(createTitleBlock({ level: 1 }));
    const input = sizeInput(wrapper);
    expect(input.attributes("step")).toBe("1");
    await input.setValue("31");
    expect(wrapper.emitted("update")).toEqual([[{ fontSize: 31 }]]);
  });

  it("does not store a fractional px size", async () => {
    const wrapper = mountIt(createTitleBlock({ level: 1 }));
    await sizeInput(wrapper).setValue("31.5");
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("emptying the size field returns the title to its level's size", async () => {
    const wrapper = mountIt(createTitleBlock({ level: 1, fontSize: 31 }));
    const input = sizeInput(wrapper);
    inputOf(input).value = "";
    await input.trigger("input");
    // Not on the keystroke: the default would land in the input mid-edit.
    expect(wrapper.emitted("update")).toBeUndefined();
    expect(inputOf(input).value).toBe("");
    await input.trigger("change");
    expect(wrapper.emitted("update")).toEqual([[{ fontSize: undefined }]]);
    expect(inputOf(input).value).toBe("36");
  });

  it("keeps the stored line height while the entry cannot be parsed yet", () => {
    const wrapper = mountIt(createTitleBlock({ lineHeight: 1.6 }));
    enterUnparseable(inputOf(lineHeightInput(wrapper)));
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("shows the stored size again when the field is left on an unusable entry", async () => {
    const wrapper = mountIt(createTitleBlock({ level: 1, fontSize: 31 }));
    const input = sizeInput(wrapper);
    await input.setValue("0");
    expect(wrapper.emitted("update")).toBeUndefined();
    await input.trigger("change");
    expect(inputOf(input).value).toBe("31");
  });

  it("shows the shared line height as the line height placeholder", () => {
    const input = lineHeightInput(mountIt(createTitleBlock()));
    expect(inputOf(input).value).toBe("");
    expect(input.attributes("placeholder")).toBe("1.3");
    expect(input.attributes("step")).toBe("0.05");
  });

  it("sets and clears the title's own line height", async () => {
    const wrapper = mountIt(createTitleBlock({ lineHeight: 1.6 }));
    const input = lineHeightInput(wrapper);
    expect(inputOf(input).value).toBe("1.6");
    await input.setValue("1.15");
    await input.setValue("");
    expect(wrapper.emitted("update")).toEqual([
      [{ lineHeight: 1.15 }],
      [{ lineHeight: undefined }],
    ]);
  });
});
