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

/**
 * Export the MJML once the stored setting is refused. The renderer warns each
 * time it leaves a refused value out, so the warning is the evidence that the
 * blur wrote the setting: without it, a negative assertion on the MJML would
 * also pass on a write that never happened.
 */
async function getMjmlOnceRefused(
  page: Page,
  field: "customHeadCss" | "customHeadTags",
): Promise<string> {
  const warning = `[Templatical] settings.${field} was left out of the render`;
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().startsWith(warning)) warnings.push(message.text());
  });
  let mjml = "";
  await expect
    .poll(async () => {
      mjml = await getMjml(page);
      return warnings.length;
    })
    .toBeGreaterThan(0);
  return mjml;
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

    // The editor itself never applies the author's head: no probe meta and no
    // probe rule anywhere in the page, shadow roots included (Playwright's CSS
    // locators pierce open shadow roots; they do not enter iframes).
    await expect(page.locator('meta[name="x-custom-head-probe"]')).toHaveCount(
      0,
    );
    const editorStyles = await page
      .locator("style")
      .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
    expect(
      editorStyles.filter((text) => text.includes(".custom-head-probe")),
    ).toEqual([]);

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

  for (const [label, tags, message] of [
    [
      "a script",
      `${META}<script>window.__x=1</script>`,
      "<script> isn't allowed here. These tags are left out of the email until it's removed.",
    ],
    [
      "a script hidden behind a quote in an unquoted value",
      `${META}<meta a=b"><script>window.__x=1</script><!-- " -->`,
      "A tag here can be read in more than one way: a < or > inside it, a quote or = in an unquoted value, or attributes without spaces between them. These tags are left out of the email until it's fixed.",
    ],
  ] as const) {
    test(`${label} is refused in the panel and never exported`, async ({
      page,
    }) => {
      await headField(page, "tags").fill(tags);
      const refusal = page.locator(
        '[data-testid="template-settings-custom-head-tags"] [data-testid="template-settings-custom-head-refusal"]',
      );
      await expect(refusal).toHaveText(message);
      await headField(page, "tags").blur();

      const mjml = await getMjmlOnceRefused(page, "customHeadTags");
      expect(mjml).not.toContain("<script");
      expect(mjml).not.toContain("x-custom-head-probe");
    });
  }

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
    expect(await getMjmlOnceRefused(page, "customHeadCss")).not.toContain(
      "custom-head-probe",
    );
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
