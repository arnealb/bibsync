import { expect, test } from "@playwright/test";

// Smoke tests for public routes + the auth gate. No auth or DB writes, so they
// are safe to run against any environment. Deeper authed flows (room → vote →
// chat) need seeded test accounts and are intentionally left for a test env.

test("landing page shows the hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("Studeer samen, pauzeer samen."),
  ).toBeVisible();
});

test("login page offers password and magic-link tabs", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Magic link")).toBeVisible();
});

test("an unauthenticated visit to /app redirects to login", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fapp/);
});
