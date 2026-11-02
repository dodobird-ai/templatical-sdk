// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import ColorPicker from "../src/components/ColorPicker.vue";
import { COLORS_KEY } from "../src/keys";
import {
  pickWithEyeDropper,
  resolveEyeDropper,
  toEyeDropperOutcome,
} from "../src/utils/eyeDropper";
import { mountEditor } from "./helpers/mount";

const EYEDROPPER = '[data-testid="color-picker-eyedropper"]';

/**
 * A stand-in for the browser EyeDropper: `open()` settles the way the next
 * test tells it to, and every signal it was handed is kept for assertions.
 */
function stubEyeDropper(settle: () => Promise<{ sRGBHex: string }>) {
  const signals: (AbortSignal | undefined)[] = [];
  const open = vi.fn((options?: { signal?: AbortSignal }) => {
    signals.push(options?.signal);
    return settle();
  });
  class FakeEyeDropper {
    open = open;
  }
  vi.stubGlobal("EyeDropper", FakeEyeDropper);
  return { open, signals };
}

function abortError(): DOMException {
  return new DOMException("The user canceled the selection.", "AbortError");
}

/**
 * Mount the picker and open its popover. `attached` puts it in the document,
 * which a click-outside test needs: a detached tree has no "outside".
 */
async function openPopover(
  props: Record<string, unknown>,
  provides = {},
  attached = false,
) {
  const wrapper = mountEditor(ColorPicker, {
    props,
    provides,
    ...(attached ? { attachTo: document.body } : {}),
  });
  await wrapper.find("button").trigger("click");
  return wrapper;
}

/**
 * A click on the page outside the picker. vueuse's onClickOutside drops a
 * click that arrives in the same task as the previous one, so this waits a
 * task first, the way a real second click would.
 */
async function clickOutside(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  document.body.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true }),
  );
  document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flushPromises();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveEyeDropper", () => {
  it("returns the constructor where the API exists and null elsewhere", () => {
    class Dropper {}
    expect(resolveEyeDropper({ EyeDropper: Dropper })).toBe(Dropper);
    expect(resolveEyeDropper({})).toBeNull();
    expect(resolveEyeDropper({ EyeDropper: "yes" })).toBeNull();
    expect(resolveEyeDropper(undefined)).toBeNull();
  });
});

describe("toEyeDropperOutcome", () => {
  it("normalizes the picked color to the picker's #rrggbb form", () => {
    const picked = (sRGBHex: string) =>
      toEyeDropperOutcome({ status: "fulfilled", value: { sRGBHex } });
    expect(picked("#1A2B3C")).toEqual({ kind: "picked", hex: "#1a2b3c" });
    expect(picked("rgb(255, 0, 128)")).toEqual({
      kind: "picked",
      hex: "#ff0080",
    });
    expect(picked("#abc")).toEqual({ kind: "picked", hex: "#aabbcc" });
  });

  it("reads AbortError as a cancel and anything else as a failure", () => {
    expect(
      toEyeDropperOutcome({ status: "rejected", reason: abortError() }),
    ).toEqual({ kind: "cancelled" });
    // A DOMException from another realm (an iframe) is not `instanceof` this
    // realm's Error; its name alone still marks it a cancel.
    const foreignAbort = { name: "AbortError", message: "canceled" };
    expect(
      toEyeDropperOutcome({ status: "rejected", reason: foreignAbort }),
    ).toEqual({ kind: "cancelled" });

    const denied = new DOMException("No activation", "NotAllowedError");
    expect(toEyeDropperOutcome({ status: "rejected", reason: denied })).toEqual(
      { kind: "failed", error: denied },
    );

    const unreadable = toEyeDropperOutcome({
      status: "fulfilled",
      value: { sRGBHex: "not-a-color" },
    });
    expect(unreadable.kind).toBe("failed");
  });
});

describe("pickWithEyeDropper", () => {
  it("turns a constructor that throws synchronously into a failure", async () => {
    const boom = new Error("boom");
    class Throwing {
      constructor() {
        throw boom;
      }
      open() {
        return Promise.resolve({ sRGBHex: "#000000" });
      }
    }
    await expect(pickWithEyeDropper(Throwing)).resolves.toEqual({
      kind: "failed",
      error: boom,
    });
  });
});

describe("ColorPicker eyedropper", () => {
  it("is absent where the browser has no EyeDropper", async () => {
    vi.stubGlobal("EyeDropper", undefined);
    const wrapper = await openPopover({ modelValue: "#333333" });
    expect(wrapper.find("hex-color-picker").exists()).toBe(true);
    expect(wrapper.find(EYEDROPPER).exists()).toBe(false);
  });

  it("emits the picked color in hex form, like a wheel pick", async () => {
    const { open } = stubEyeDropper(async () => ({ sRGBHex: "#12AB9F" }));
    const wrapper = await openPopover({ modelValue: "#333333" });
    const button = wrapper.get(EYEDROPPER);
    expect(button.text()).toBe("colorPicker.pickFromScreen");
    expect(button.attributes("type")).toBe("button");

    await button.trigger("click");
    await flushPromises();

    expect(open).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("update:modelValue")).toEqual([["#12ab9f"]]);
  });

  it("is offered in swatch-only mode too, inside the popover", async () => {
    stubEyeDropper(async () => ({ sRGBHex: "#00ff00" }));
    const wrapper = await openPopover({ modelValue: "", swatchOnly: true });
    await wrapper.get(EYEDROPPER).trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toEqual([["#00ff00"]]);
  });

  it("does nothing when the author cancels with Escape", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubEyeDropper(() => Promise.reject(abortError()));
    const wrapper = await openPopover({ modelValue: "#333333" });
    await wrapper.get(EYEDROPPER).trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    // Vue's own "unknown custom element" warnings share console.warn; only
    // the editor's tagged warnings matter here.
    expect(warn.mock.calls.filter(([tag]) => tag === "[Templatical]")).toEqual(
      [],
    );
    expect(wrapper.get(EYEDROPPER).attributes("aria-disabled")).toBe("false");
  });

  it("warns and keeps the value when the eyedropper fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const denied = new DOMException("No activation", "NotAllowedError");
    stubEyeDropper(() => Promise.reject(denied));
    const wrapper = await openPopover({ modelValue: "#333333" });
    await wrapper.get(EYEDROPPER).trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      "[Templatical]",
      "Eyedropper could not pick a color:",
      denied,
    );
  });

  it("is not offered on a locked palette", async () => {
    stubEyeDropper(async () => ({ sRGBHex: "#00ff00" }));
    const locked = await openPopover(
      { modelValue: "#ff0000" },
      {
        [COLORS_KEY]: { presets: ["#ff0000", "#00ff00"], allowCustom: false },
      },
    );
    expect(locked.find('[role="radiogroup"]').exists()).toBe(true);
    expect(locked.find(EYEDROPPER).exists()).toBe(false);

    const lockedByProp = await openPopover({
      modelValue: "#ff0000",
      presets: ["#ff0000"],
      allowCustom: false,
    });
    expect(lockedByProp.find(EYEDROPPER).exists()).toBe(false);
  });

  it("marks itself busy while a session is open and ignores a second click", async () => {
    let resolvePick: (value: { sRGBHex: string }) => void = () => {};
    const { open } = stubEyeDropper(
      () =>
        new Promise((resolve) => {
          resolvePick = resolve;
        }),
    );
    const wrapper = await openPopover({ modelValue: "#333333" });
    await wrapper.get(EYEDROPPER).trigger("click");
    expect(wrapper.get(EYEDROPPER).attributes("aria-busy")).toBe("true");
    expect(wrapper.get(EYEDROPPER).attributes("aria-disabled")).toBe("true");
    // Busy is aria-disabled, not native `disabled`: a native disabled button
    // drops keyboard focus to <body>, stranding the author outside the
    // popover. So this second click really reaches the handler, and the
    // session guard is what refuses it.
    expect(wrapper.get(EYEDROPPER).attributes("disabled")).toBeUndefined();

    await wrapper.get(EYEDROPPER).trigger("click");
    expect(open).toHaveBeenCalledTimes(1);

    resolvePick({ sRGBHex: "#0000ff" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toEqual([["#0000ff"]]);
    expect(wrapper.get(EYEDROPPER).attributes("aria-busy")).toBe("false");
  });

  it("aborts a pending session when the popover closes, emitting nothing", async () => {
    let resolvePick: (value: { sRGBHex: string }) => void = () => {};
    const { signals } = stubEyeDropper(
      () =>
        new Promise((resolve) => {
          resolvePick = resolve;
        }),
    );
    const wrapper = await openPopover({ modelValue: "#333333" });
    await wrapper.get(EYEDROPPER).trigger("click");
    expect(signals[0]?.aborted).toBe(false);

    await wrapper.find("button").trigger("click"); // swatch: close popover
    expect(signals[0]?.aborted).toBe(true);

    resolvePick({ sRGBHex: "#0000ff" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("aborts a pending session when the picker unmounts", async () => {
    const { signals } = stubEyeDropper(() => new Promise(() => {}));
    const wrapper = await openPopover({ modelValue: "#333333" });
    await wrapper.get(EYEDROPPER).trigger("click");
    expect(signals[0]?.aborted).toBe(false);

    wrapper.unmount();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("emits nothing when the field is disabled while a session is open", async () => {
    let resolvePick: (value: { sRGBHex: string }) => void = () => {};
    const { signals } = stubEyeDropper(
      () =>
        new Promise((resolve) => {
          resolvePick = resolve;
        }),
    );
    const wrapper = await openPopover({ modelValue: "#333333" });
    await wrapper.get(EYEDROPPER).trigger("click");

    await wrapper.setProps({ disabled: true });
    expect(signals[0]?.aborted).toBe(true);

    resolvePick({ sRGBHex: "#0000ff" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("keeps the popover open for the click that picks outside it", async () => {
    let resolvePick: (value: { sRGBHex: string }) => void = () => {};
    const { signals } = stubEyeDropper(
      () =>
        new Promise((resolve) => {
          resolvePick = resolve;
        }),
    );
    const wrapper = await openPopover({ modelValue: "#333333" }, {}, true);
    await wrapper.get(EYEDROPPER).trigger("click");

    // The pick lands on the page, outside the popover.
    await clickOutside();
    expect(signals[0]?.aborted).toBe(false);
    expect(wrapper.find(EYEDROPPER).exists()).toBe(true);

    resolvePick({ sRGBHex: "#0000ff" });
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toEqual([["#0000ff"]]);

    // With no session open, an outside click closes the popover as before.
    await clickOutside();
    expect(wrapper.find(EYEDROPPER).exists()).toBe(false);
    wrapper.unmount();
  });

  it("closes the popover on Escape from the eyedropper button", async () => {
    stubEyeDropper(async () => ({ sRGBHex: "#00ff00" }));
    const wrapper = await openPopover({ modelValue: "#333333" });
    await wrapper.get(EYEDROPPER).trigger("keydown", { key: "Escape" });
    expect(wrapper.find(EYEDROPPER).exists()).toBe(false);
  });
});
