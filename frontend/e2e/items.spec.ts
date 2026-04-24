import { test, expect, Page } from "@playwright/test";
import { loginViaApi } from "./helpers/auth";
import path from "path";

const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.jpg");
const timestamp = Date.now();

/**
 * Helper: open Add Item form, upload image, fill title + category.
 * Returns the title used.
 */
async function startAddItem(page: Page, suffix: string): Promise<string> {
  const title = `E2E ${suffix} ${timestamp}`;

  await page.goto("/my-items");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByText(/images/i).first()).toBeVisible();

  // Upload image
  await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);

  // Fill title
  await page.getByPlaceholder(/vintage radio/i).fill(title);

  // Select category (first real option)
  await page.locator("select").first().selectOption({ index: 1 });

  return title;
}

/**
 * Helper: scroll down in the form panel.
 */
async function scrollForm(page: Page, amount: number) {
  const panel = page.locator('[class*="overflow-y-auto"]');
  await panel.evaluate((el, y) => (el.scrollTop = y), amount);
}

/**
 * Helper: delete an item by title (open edit → delete).
 */
async function deleteItemByTitle(page: Page, title: string) {
  await page.goto("/my-items");
  await page.waitForLoadState("networkidle");

  const card = page.locator(`text=${title}`).first();
  await expect(card).toBeVisible();

  const cardContainer = card
    .locator("xpath=ancestor::div[contains(@class, 'rounded')]")
    .first();
  await cardContainer.locator("button").last().click();

  await expect(page.getByText(/edit item/i)).toBeVisible();

  const deleteButton = page.getByRole("button", { name: /delete item/i });
  await deleteButton.scrollIntoViewIfNeeded();

  page.on("dialog", (dialog) => dialog.accept());
  await deleteButton.click();

  await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });
}

// ─── CRUD tests (serial: create → edit → delete) ───

const CRUD_TITLE = `E2E CRUD ${timestamp}`;
const CRUD_EDITED = `${CRUD_TITLE} Edited`;

test.describe.serial("Item CRUD — Fixed Price", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test("create item", async ({ page }) => {
    const title = await startAddItem(page, "CRUD");

    // Fixed Price is default — fill price
    await scrollForm(page, 500);
    await page.locator('input[placeholder="0.00"]').first().fill("99.50");

    await page.getByRole("button", { name: /save item/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
  });

  test("edit item title", async ({ page }) => {
    await page.goto("/my-items");
    await page.waitForLoadState("networkidle");

    const card = page.locator(`text=${CRUD_TITLE}`).first();
    await expect(card).toBeVisible();

    const cardContainer = card
      .locator("xpath=ancestor::div[contains(@class, 'rounded')]")
      .first();
    await cardContainer.locator("button").last().click();

    await expect(page.getByText(/edit item/i)).toBeVisible();

    const titleInput = page.getByPlaceholder(/vintage radio/i);
    await titleInput.clear();
    await titleInput.fill(CRUD_EDITED);

    await page.getByRole("button", { name: /save item/i }).click();
    await expect(page.getByText(CRUD_EDITED)).toBeVisible({ timeout: 10000 });
  });

  test("delete item", async ({ page }) => {
    await deleteItemByTitle(page, CRUD_EDITED);
  });
});

// ─── Pricing Type tests (each creates + deletes its own item) ───

test.describe("Pricing Types", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test("Fixed Price — create and delete", async ({ page }) => {
    const title = await startAddItem(page, "Fixed");

    await scrollForm(page, 500);
    await page.locator('input[placeholder="0.00"]').first().fill("50");

    await page.getByRole("button", { name: /save item/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

    // Cleanup
    await deleteItemByTitle(page, title);
  });

  test("Fixed + Offers — create and delete", async ({ page }) => {
    const title = await startAddItem(page, "Offers");

    await scrollForm(page, 500);

    // Click "Fixed + Offers" pricing card
    await page.getByRole("button", { name: /fixed \+ offers/i }).click();

    // Fill listed price
    await page.locator('input[placeholder="0.00"]').first().fill("100");

    // Min offer price (optional — fill it to test the field)
    const minOfferInputs = page.locator('input[placeholder="0.00"]');
    if ((await minOfferInputs.count()) > 1) {
      await minOfferInputs.nth(1).fill("50");
    }

    await page.getByRole("button", { name: /save item/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

    await deleteItemByTitle(page, title);
  });

  test("Open Bidding — create and delete", async ({ page }) => {
    const title = await startAddItem(page, "Bidding");

    await scrollForm(page, 500);

    // Click "Open Bidding" pricing card
    await page.getByRole("button", { name: /open bidding/i }).click();

    // No required fields for open bidding — save directly
    await page.getByRole("button", { name: /save item/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

    await deleteItemByTitle(page, title);
  });

  test("Auction — create and delete", async ({ page }) => {
    const title = await startAddItem(page, "Auction");

    await scrollForm(page, 500);

    // Click "Auction" pricing card
    await page.getByRole("button", { name: /^auction/i }).click();

    // Fill starting price
    await page.locator('input[placeholder="0.00"]').first().fill("200");

    // Pick auction end date — click the date picker button
    await scrollForm(page, 700);
    const dateButton = page.locator('button[type="button"]').filter({ hasText: /DD\.MM\.YYYY/ });
    await dateButton.click();

    // Select a future date (click a day number > today in the calendar)
    const calendarDiv = page.locator('[class*="rounded-md border"][class*="bg-popover"]');
    await expect(calendarDiv).toBeVisible();
    // Pick the last enabled day visible
    const dayButtons = calendarDiv.locator('button:not([disabled])');
    const count = await dayButtons.count();
    if (count > 0) {
      await dayButtons.nth(count - 1).click();
    }

    // Time defaults to 23:59 — leave as-is

    await page.getByRole("button", { name: /save item/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

    await deleteItemByTitle(page, title);
  });
});
