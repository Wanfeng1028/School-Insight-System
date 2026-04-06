import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "admin@school.local";
const ADMIN_PASSWORD = "Admin12345";

function uniqueCameraName() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `mock-camera-${stamp}`;
}

async function gotoAuthPage(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "轨迹分析控制台" }).first()).toBeVisible();
}

async function loginAsAdmin(page) {
  await gotoAuthPage(page);
  await page.locator("label").filter({ hasText: "邮箱" }).locator("input").fill(ADMIN_EMAIL);
  await page.locator("label").filter({ hasText: "密码" }).locator("input").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "进入系统" }).click();
  await expect(page.getByRole("heading", { name: "实时监控大屏" })).toBeVisible();
}

test.describe("实时监控大屏", () => {
  test("默认可展示摄像头网格与实时目标框", async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByTestId("camera-list-item").first()).toBeVisible();
    await expect(page.getByTestId("camera-tile").first()).toBeVisible();
    await expect(page.getByTestId("camera-bbox").first()).toBeVisible({ timeout: 15000 });
  });

  test("支持创建新的 mock 摄像头并自动进入监控网格", async ({ page }) => {
    const cameraName = uniqueCameraName();
    await loginAsAdmin(page);

    await page.getByTestId("camera-create-trigger").click();
    await page.locator("label").filter({ hasText: "摄像头名称" }).locator("input").fill(cameraName);
    await page.getByRole("button", { name: "创建摄像头" }).click();

    await expect(page.getByText("摄像头已创建。")).toBeVisible();
    await expect(page.getByText(cameraName)).toBeVisible();
    await expect(page.getByTestId("camera-tile").filter({ hasText: cameraName })).toBeVisible({ timeout: 15000 });
  });
});
