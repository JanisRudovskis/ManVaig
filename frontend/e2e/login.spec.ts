import { test, expect } from "@playwright/test";
import { TEST_USER, loginViaUi } from "./helpers/auth";

test.describe("Login", () => {
  test("login page renders email, password, and submit button", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /log in/i })
    ).toBeVisible();
  });

  test("wrong credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill("wrong@example.com");
    await page.locator("#login-password").fill("wrongpassword");
    await page.getByRole("button", { name: /log in/i }).click();
    // Should show an error message (not redirect)
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("text=Invalid")).toBeVisible({ timeout: 5000 });
  });

  test("correct credentials redirects to home", async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL("/");
  });
});
