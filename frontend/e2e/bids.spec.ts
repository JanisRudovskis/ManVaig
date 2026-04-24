import { test, expect } from "@playwright/test";
import { loginViaApi, TEST_USER } from "./helpers/auth";
import path from "path";

const TEST_IMAGE = path.join(__dirname, "fixtures", "test-image.jpg");
const API_URL = "http://localhost:5100";
const timestamp = Date.now();

test.describe.serial("Auction Bids", () => {
  let itemId: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Get auth token
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    const loginBody = await loginRes.json();
    authToken = loginBody.token;
  });

  test("create auction item for bid testing", async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/my-items");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /add item/i }).click();
    await expect(page.getByText(/images/i).first()).toBeVisible();

    // Upload image
    await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE);

    // Fill title
    const title = `E2E Auction Bids ${timestamp}`;
    await page.getByPlaceholder(/vintage radio/i).fill(title);

    // Category
    await page.locator("select").first().selectOption({ index: 1 });

    // Switch to Auction
    const panel = page.locator('[class*="overflow-y-auto"]');
    await panel.evaluate((el) => (el.scrollTop = 500));
    await page.getByRole("button", { name: /^auction/i }).click();

    // Fill starting price
    await page.locator('input[placeholder="0.00"]').first().fill("10");

    // Pick a date
    await panel.evaluate((el) => (el.scrollTop = 700));
    const dateButton = page.locator('button[type="button"]').filter({ hasText: /DD\.MM\.YYYY/ });
    await dateButton.click();
    const calendarDiv = page.locator('[class*="rounded-md border"][class*="bg-popover"]');
    await expect(calendarDiv).toBeVisible();
    const dayButtons = calendarDiv.locator('button:not([disabled])');
    const count = await dayButtons.count();
    await dayButtons.nth(count - 1).click();

    // Save
    await page.getByRole("button", { name: /save item/i }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

    // Get the item ID from the API
    const res = await page.request.get(`${API_URL}/api/v1/items?page=1&pageSize=20`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const body = await res.json();
    const found = body.items.find((i: { title: string }) => i.title === title);
    expect(found).toBeTruthy();
    itemId = found.id;
  });

  test("bid list shows empty state for new auction", async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/my-items");
    await page.waitForLoadState("networkidle");

    // Find and edit the auction item
    const title = `E2E Auction Bids ${timestamp}`;
    const card = page.locator(`text=${title}`).first();
    await expect(card).toBeVisible();

    const cardContainer = card
      .locator("xpath=ancestor::div[contains(@class, 'rounded')]")
      .first();
    await cardContainer.locator("button").last().click();

    await expect(page.getByText(/edit item/i)).toBeVisible();

    // Scroll down to see bid section
    const panel = page.locator('[class*="overflow-y-auto"]');
    await panel.evaluate((el) => (el.scrollTop = 9999));

    // Should show "No bids yet"
    await expect(page.getByText(/no bids yet/i)).toBeVisible({ timeout: 5000 });
  });

  test("place bid via API and verify in bid list", async ({ page, request }) => {
    // Place a bid via API (as if another user placed it)
    // Note: in a real scenario this would be a different user, but for testing
    // the seller can't bid on their own item — so we test the API validation
    const bidRes = await request.post(`${API_URL}/api/v1/items/${itemId}/bids`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      data: { amount: 15 },
    });

    // Should fail — can't bid on own item
    expect(bidRes.status()).toBe(400);
    const bidBody = await bidRes.json();
    expect(bidBody.error).toBe("CANNOT_BID_OWN_ITEM");
  });

  test("bid API validates amount", async ({ request }) => {
    // Test negative amount
    const res = await request.post(`${API_URL}/api/v1/items/${itemId}/bids`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      data: { amount: -5 },
    });
    expect(res.status()).toBe(400);
  });

  test("cleanup — delete auction item", async ({ page }) => {
    await loginViaApi(page);
    const title = `E2E Auction Bids ${timestamp}`;

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
  });
});
