import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, blockByType } from "../helpers/selectors";

/**
 * A title's own size and line height, set from the title settings, must reach
 * the canvas title as it is displayed and the exported MJML. Unit tests cover
 * each side; only the running editor shows the field, the store, the canvas
 * styles and the export joined up, in the shadow and light-DOM projects.
 */

async function getMjml(page: Page): Promise<string> {
  await page.waitForFunction(
    () =>
      typeof (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
        .__tplPlaygroundGetMjml === "function",
  );
  return page.evaluate(() =>
    (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
      .__tplPlaygroundGetMjml!(),
  );
}

/** Computed font size and line height of the first canvas title's heading. */
async function canvasTitle(
  page: Page,
): Promise<{ fontSize: string; lineHeight: string }> {
  return page
    .locator(`${blockByType("title")} .tpl-text-content`)
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { fontSize: style.fontSize, lineHeight: style.lineHeight };
    });
}

test.describe("Title size and title line height", () => {
  test("a title takes a size and line height of its own, and gives them back", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("title");
    const panel = page.locator(SELECTORS.rightPanelContent);
    const size = panel.locator(SELECTORS.titleFontSize);
    const lineHeight = panel.locator(SELECTORS.titleLineHeight);

    // The title sets neither, so both fields are empty and show the value in
    // effect, and the canvas title is at its level's size.
    await expect(size).toHaveValue("");
    await expect(lineHeight).toHaveValue("");
    await expect(lineHeight).toHaveAttribute("placeholder", "1.3");
    const levelSize = await size.getAttribute("placeholder");
    expect(["36", "28", "22", "18"]).toContain(levelSize);
    expect((await canvasTitle(page)).fontSize).toBe(`${levelSize}px`);

    // 31px is no heading level's size and not on the paragraph preset list.
    await size.fill("31");
    await lineHeight.fill("1.5");

    await expect
      .poll(() => canvasTitle(page), {
        message: "canvas title should follow the title settings",
      })
      .toEqual({ fontSize: "31px", lineHeight: "46.5px" });

    // Both attributes on the title's own mj-text: paragraphs, menus and
    // tables all write line-height="1.5" too, so an unscoped match would pass
    // on any later block.
    const mjml = await getMjml(page);
    expect(mjml).toMatch(/<mj-text\s+font-size="31px"[^>]*line-height="1\.5"/);

    // A lone "-" is what Chromium reports as an empty value with
    // validity.badInput set. It must not read as the field being emptied: the
    // title keeps 1.5 (46.5px), not the default 1.3 (40.3px).
    await lineHeight.click();
    await lineHeight.press("ControlOrMeta+a");
    await lineHeight.pressSequentially("-");
    expect(
      await lineHeight.evaluate(
        (el) => el instanceof HTMLInputElement && el.validity.badInput,
      ),
    ).toBe(true);
    expect((await canvasTitle(page)).lineHeight).toBe("46.5px");
    await lineHeight.fill("1.2");
    await expect
      .poll(async () => (await canvasTitle(page)).lineHeight)
      .toBe("37.2px");

    // A 0 is no size, so it changes nothing, and leaving the field shows the
    // stored size again.
    await size.fill("0");
    await size.blur();
    await expect(size).toHaveValue("31");
    expect((await canvasTitle(page)).fontSize).toBe("31px");

    // Emptying the size field hands the title back to its level.
    await size.fill("");
    await expect
      .poll(async () => (await canvasTitle(page)).fontSize)
      .toBe(`${levelSize}px`);
    await expect(size).toHaveAttribute("placeholder", levelSize!);
  });
});
