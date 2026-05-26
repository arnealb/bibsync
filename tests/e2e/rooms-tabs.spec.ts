import { expect, test } from "@playwright/test";

const dummyId = "11111111-1111-1111-1111-111111111111";

test.describe("new room sub-routes are auth-gated", () => {
  test("/app/rooms/<id>/chat redirects to login", async ({ page }) => {
    await page.goto(`/app/rooms/${dummyId}/chat`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/app/rooms/<id>/games redirects to login", async ({ page }) => {
    await page.goto(`/app/rooms/${dummyId}/games`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/app/rooms/<id>/games/snake redirects to login", async ({ page }) => {
    await page.goto(`/app/rooms/${dummyId}/games/snake`);
    await expect(page).toHaveURL(/\/login/);
  });
});
