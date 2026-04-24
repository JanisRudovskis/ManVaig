import { Page } from "@playwright/test";

export const TEST_USER = {
  email: "janis.rudovskis@inbox.lv",
  password: "tUZET8Gp3r8gC@x",
};

const API_URL = "http://localhost:5100";
const TOKEN_KEY = "manvaig_token";

/**
 * Login via the UI — use for testing the login flow itself.
 */
export async function loginViaUi(page: Page) {
  await page.goto("/login");
  await page.locator("#login-email").fill(TEST_USER.email);
  await page.locator("#login-password").fill(TEST_USER.password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("/");
}

/**
 * Login via API + inject token — fast, use for tests that need auth but aren't testing login.
 */
export async function loginViaApi(page: Page) {
  const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });
  const body = await response.json();
  const token = body.token;

  // Inject token into localStorage before page loads
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: TOKEN_KEY, value: token }
  );
}
