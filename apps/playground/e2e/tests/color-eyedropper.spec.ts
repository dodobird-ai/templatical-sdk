import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";
import type { EditorPage } from "../pages/editor.page";

// The ColorPicker swatch trigger; the first one in a button's toolbar is the
// background-color picker (see color-presets.spec.ts).
const PICK_COLOR = 'button[aria-label="Pick a color"]';
const EYEDROPPER = '[data-testid="color-picker-eyedropper"]';

declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
    __eyeDropperOpens?: number;
  }
}

/**
 * Replace the browser's EyeDropper before the editor boots. Chromium ships a
 * real one, but it waits for a click on the screen, which a test cannot give;
 * the stand-in settles at once the way `mode` says. Every `open()` is counted
 * on `window.__eyeDropperOpens` so a spec can tell the stand-in was reached.
 */
async function stubEyeDropper(
  page: Page,
  mode: "pick" | "cancel" | "unsupported",
) {
  await page.addInitScript((stubMode) => {
    if (stubMode === "unsupported") {
      delete window.EyeDropper;
      return;
    }
    window.__eyeDropperOpens = 0;
    window.EyeDropper = class {
      open(): Promise<{ sRGBHex: string }> {
        window.__eyeDropperOpens = (window.__eyeDropperOpens ?? 0) + 1;
        return stubMode === "pick"
          ? Promise.resolve({ sRGBHex: "#12AB9F" })
          : Promise.reject(
              new DOMException(
                "The user canceled the selection.",
                "AbortError",
              ),
            );
      }
    };
  }, mode);
}

async function openButtonColorPicker(editorPage: EditorPage, page: Page) {
  await editorPage.selectBlockByType("button");
  const panel = page.locator(SELECTORS.rightPanelContent);
  await expect(panel).toBeVisible();
  await panel.locator(PICK_COLOR).first().click();
  const popover = page.locator(".tpl-color-popover");
  await expect(popover).toBeVisible();
  return { panel, popover };
}

test.describe("Color picker eyedropper", () => {
  test("a picked screen colour becomes the field's value", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await stubEyeDropper(page, "pick");
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const { panel, popover } = await openButtonColorPicker(editorPage, page);
    const eyedropper = popover.locator(EYEDROPPER);
    await expect(eyedropper).toHaveText("Pick from screen");
    await eyedropper.click();

    await expect
      .poll(() => page.evaluate(() => window.__eyeDropperOpens))
      .toBe(1);
    const swatch = panel.locator(PICK_COLOR).first().locator("span");
    await expect(swatch).toHaveCSS("background-color", "rgb(18, 171, 159)");
    await expect(
      panel.locator('input[aria-label="Hex color value"]').first(),
    ).toHaveValue("#12ab9f");
  });

  test("cancelling with Escape leaves the colour unchanged", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await stubEyeDropper(page, "cancel");
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const { panel, popover } = await openButtonColorPicker(editorPage, page);
    const hexInput = panel
      .locator('input[aria-label="Hex color value"]')
      .first();
    const before = await hexInput.inputValue();
    await popover.locator(EYEDROPPER).click();

    await expect
      .poll(() => page.evaluate(() => window.__eyeDropperOpens))
      .toBe(1);
    await expect(popover.locator(EYEDROPPER)).toBeEnabled();
    await expect(hexInput).toHaveValue(before);
  });

  test("is hidden where the browser has no EyeDropper", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await stubEyeDropper(page, "unsupported");
    await scenePage.goto("example-launchpad-launch");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const { popover } = await openButtonColorPicker(editorPage, page);
    await expect(popover.locator("hex-color-picker")).toBeVisible();
    await expect(popover.locator(EYEDROPPER)).toHaveCount(0);
  });

  test("is not offered on a brand-locked palette", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    // Northstage passes `colors: { presets, allowCustom: false }`.
    await stubEyeDropper(page, "pick");
    await scenePage.goto("example-northstage-event");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();

    const { popover } = await openButtonColorPicker(editorPage, page);
    await expect(popover.locator('[role="radiogroup"]')).toBeVisible();
    await expect(popover.locator(EYEDROPPER)).toHaveCount(0);
  });
});
