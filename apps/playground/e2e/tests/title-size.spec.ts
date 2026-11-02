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

    const mjml = await getMjml(page);
    expect(mjml).toMatch(/font-size="31px"[\s\S]*?line-height="1\.5"/);

    // Emptying the size field hands the title back to its level.
    await size.fill("");
    await expect
      .poll(async () => (await canvasTitle(page)).fontSize)
      .toBe(`${levelSize}px`);
    await expect(size).toHaveAttribute("placeholder", levelSize!);
  });
});
