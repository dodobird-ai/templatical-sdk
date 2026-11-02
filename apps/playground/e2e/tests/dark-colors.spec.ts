import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS, darkColorInput } from "../helpers/selectors";

// Dark colors: an author picks the colors a block (or the template) uses in a
// mail client's dark mode. The canvas dark preview shows them instead of
// inverting, and the exported MJML carries them as dark-mode CSS.
test.describe("Dark mode colors", () => {
  test("inverts the canvas for a template without dark colors", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.toggleDarkMode();
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute(
      "data-dark-preview",
      "inverted",
    );
    await expect(page.locator(SELECTORS.canvasBackground)).toHaveCSS(
      "filter",
      "invert(1) hue-rotate(180deg)",
    );
  });

  test("previews a title's dark text color instead of inverting", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("title");
    await page.locator(SELECTORS.darkColorsToggle).click();
    await page.locator(darkColorInput("block", "textColor")).fill("#ff00ff");

    await editorPage.toggleDarkMode();
    await expect(page.locator(SELECTORS.canvas)).toHaveAttribute(
      "data-dark-preview",
      "authored",
    );
    await expect(page.locator(SELECTORS.canvasBackground)).toHaveCSS(
      "filter",
      "none",
    );
    await expect(
      editorPage
        .getBlockByType("title")
        .first()
        .locator(SELECTORS.textContent),
    ).toHaveCSS("color", "rgb(255, 0, 255)");

    // Off again, the title is back to its light color.
    await editorPage.toggleDarkMode();
    await expect(
      editorPage
        .getBlockByType("title")
        .first()
        .locator(SELECTORS.textContent),
    ).not.toHaveCSS("color", "rgb(255, 0, 255)");
  });

  test("previews the template's dark background", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openSettingsTab();
    await page
      .locator(darkColorInput("template", "backgroundColor"))
      .fill("#123456");
    await editorPage.toggleDarkMode();
    await expect(page.locator(SELECTORS.canvasBackground)).toHaveCSS(
      "background-color",
      "rgb(18, 52, 86)",
    );
  });

  test("exports the dark colors as dark-mode CSS", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.selectBlockByType("title");
    await page.locator(SELECTORS.darkColorsToggle).click();
    await page.locator(darkColorInput("block", "textColor")).fill("#ff00ff");
    await editorPage.deselectBlock();

    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabMjml).click();
    await expect
      .poll(async () => page.locator(".cm-content").first().textContent())
      .toContain(
        ".tpl-dark-text-ff00ff, .tpl-dark-text-ff00ff * { color: #ff00ff !important; }",
      );
  });
});
