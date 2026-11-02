import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Custom head — `settings.customHeadCss` and `settings.customHeadTags`, edited
 * in the Settings tab's Custom head card. Unit tests cover the policy and the
 * MJML; this file proves the browser path: typing in the real panel (light and
 * shadow DOM), the setting landing in the exported MJML on blur, the compiled
 * HTML of the export preview carrying it in its `<head>`, and a refused value
 * never reaching either.
 */

const SCENE = "example-launchpad-launch";
const CSS = ".custom-head-probe a { color: #777777 !important; }";
const META = '<meta name="x-custom-head-probe" content="1">';
const OUTLOOK = `<!--[if mso]><style>td { font-family: 'Segoe UI', Arial, sans-serif; }</style><![endif]-->`;

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

function headField(page: Page, name: "css" | "tags") {
  return page.locator(
    `[data-testid="template-settings-custom-head-${name}"] textarea`,
  );
}

test.describe("custom head", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto(SCENE);
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.closeCodeDrawer();
    await editorPage.openSettingsTab();
  });

  test("a template without a custom head exports none", async ({ page }) => {
    await expect(
      page.locator(SELECTORS.templateSettingsCard("head")),
    ).toBeVisible();
    const mjml = await getMjml(page);
    expect(mjml).not.toContain("custom-head-probe");
    expect(mjml.slice(0, mjml.indexOf("</mj-head>"))).not.toContain("<mj-raw>");
  });

  test("CSS and head tags reach the exported MJML and the compiled head", async ({
    page,
    editorPage,
  }) => {
    await headField(page, "css").fill(CSS);
    await headField(page, "css").blur();
    await headField(page, "tags").fill(`${META}\n${OUTLOOK}`);
    await headField(page, "tags").blur();

    await expect
      .poll(() => getMjml(page))
      .toContain(
        `<mj-raw>\n${META}\n${OUTLOOK}\n    </mj-raw>\n    <mj-style>\n${CSS}\n    </mj-style>\n  </mj-head>`,
      );

    await editorPage.openExport();
    const frame = page.frameLocator(SELECTORS.exportPreviewFrame);
    await expect(
      frame.locator('head meta[name="x-custom-head-probe"]'),
    ).toHaveCount(1);
    const styles = await frame
      .locator("head style")
      .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
    expect(styles.some((text) => text.includes(".custom-head-probe a"))).toBe(
      true,
    );
  });

  test("a script is refused in the panel and never exported", async ({
    page,
  }) => {
    await headField(page, "tags").fill(`${META}<script>window.__x=1</script>`);
    const refusal = page.locator(
      '[data-testid="template-settings-custom-head-tags"] [data-testid="template-settings-custom-head-refusal"]',
    );
    await expect(refusal).toHaveText(
      "<script> isn't allowed here. These tags are left out of the email until it's removed.",
    );
    await headField(page, "tags").blur();

    const mjml = await getMjml(page);
    expect(mjml).not.toContain("<script");
    expect(mjml).not.toContain("x-custom-head-probe");
  });

  test("a CSS value that would close its style tag is refused", async ({
    page,
  }) => {
    await headField(page, "css").fill(`${CSS}</style>`);
    await expect(
      page.locator(
        '[data-testid="template-settings-custom-head-css"] [data-testid="template-settings-custom-head-refusal"]',
      ),
    ).toHaveText(
      "CSS can't contain “<”. This CSS is left out of the email until it's fixed.",
    );
    await headField(page, "css").blur();
    expect(await getMjml(page)).not.toContain("custom-head-probe");
  });

  test("one edit is one undo step", async ({ page }) => {
    await headField(page, "css").fill(CSS);
    await headField(page, "css").blur();
    await expect.poll(() => getMjml(page)).toContain(CSS);

    // Focus has left the textarea (blur), so the editor's shortcut, not the
    // textarea's native undo, handles the key.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(headField(page, "css")).toHaveValue("");
    await expect.poll(() => getMjml(page)).not.toContain(CSS);
  });
});
