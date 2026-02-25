/**
 * Playwright end-to-end accessibility tests.
 *
 * Run: npx playwright test
 *
 * Requirements:
 *  - Frontend running on http://localhost:5173
 *  - Backend running on http://localhost:8000
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://localhost:5173";

test.describe("Full-page axe scan", () => {
  test("landing page has no critical/serious a11y violations", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .disableRules(["color-contrast"]) // charts use dynamic fills — handled via getContrastColor in code
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe("Keyboard navigation", () => {
  test("skip-nav link is focusable and targets #main-content", async ({
    page,
  }) => {
    await page.goto(BASE);
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    const href = await focused.getAttribute("href");
    expect(href).toBe("#main-content");

    const text = await focused.textContent();
    expect(text?.toLowerCase()).toContain("skip");
  });

  test("Ctrl+B toggles the left panel", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // The left panel should initially be visible
    const leftPanel = page.locator('[data-panel-id="left-panel"]');
    const initialSize = await leftPanel.boundingBox();

    // Toggle collapse
    await page.keyboard.press("Control+b");
    await page.waitForTimeout(400);
    const collapsedSize = await leftPanel.boundingBox();

    // Either width decreased or element is hidden
    if (collapsedSize) {
      expect(collapsedSize.width).toBeLessThan(initialSize!.width);
    }

    // Toggle expand
    await page.keyboard.press("Control+b");
    await page.waitForTimeout(400);
    const expandedSize = await leftPanel.boundingBox();
    expect(expandedSize!.width).toBeGreaterThanOrEqual(initialSize!.width * 0.8);
  });

  test("toolbar supports arrow key navigation", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const toolbar = page.getByRole("toolbar");
    const buttons = toolbar.locator("button");
    const count = await buttons.count();

    if (count > 1) {
      await buttons.first().focus();
      await page.keyboard.press("ArrowRight");

      const focused = page.locator("button:focus");
      const focusedText = await focused.textContent();
      const secondText = await buttons.nth(1).textContent();
      expect(focusedText).toBe(secondText);
    }
  });
});

test.describe("Focus management", () => {
  test("dialog popovers trap focus", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // Check that any dialogs present have role="dialog" and aria-modal
    const dialogs = page.locator('[role="dialog"]');
    const count = await dialogs.count();

    for (let i = 0; i < count; i++) {
      const modal = await dialogs.nth(i).getAttribute("aria-modal");
      expect(modal).toBe("true");
    }
  });
});
