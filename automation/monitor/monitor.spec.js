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
  await expect(page.getByRole("heading", { name: "实时监控大屏" })).toBeVisible({ timeout: 20000 });
}

async function ensureAtLeastOneActiveCamera(page) {
  if (await page.getByTestId("camera-tile").count()) {
    return;
  }
  await page.getByTestId("camera-list-item").first().getByText("启动").click();
  await expect(page.getByTestId("camera-tile").first()).toBeVisible({ timeout: 15000 });
}

test.describe("实时监控大屏", () => {
  test("默认可展示摄像头网格与实时目标框", async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByTestId("camera-list-item").first()).toBeVisible();
    await ensureAtLeastOneActiveCamera(page);
    await expect(page.getByTestId("camera-tile").first()).toBeVisible();
    await expect(page.getByTestId("camera-bbox").first()).toBeVisible({ timeout: 15000 });
  });

  test("支持创建新的 mock 摄像头并出现在监控配置列表中", async ({ page }) => {
    const cameraName = uniqueCameraName();
    await loginAsAdmin(page);

    await page.getByTestId("camera-create-trigger").click();
    await expect(page.getByTestId("camera-editor-modal")).toBeVisible();
    await page.locator("label").filter({ hasText: "摄像头名称" }).locator("input").fill(cameraName);
    await page.getByRole("button", { name: "创建摄像头" }).click();

    const createdItem = page.getByTestId("camera-list-item").filter({ hasText: cameraName });
    await expect(createdItem).toBeVisible();
    await createdItem.getByTestId("camera-edit-trigger").click();
    await expect(page.getByTestId("camera-editor-modal")).toBeVisible();
    await expect(page.getByRole("heading", { name: "编辑摄像头" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "摄像头名称" }).locator("input")).toHaveValue(cameraName);
  });

  test("点击编辑按钮后切换当前编辑对象并可回到新建模式", async ({ page }) => {
    await loginAsAdmin(page);

    const firstItem = page.getByTestId("camera-list-item").first();
    const firstName = ((await firstItem.locator("strong").textContent()) || "").trim();
    await firstItem.getByTestId("camera-edit-trigger").click();

    await expect(firstItem).toHaveClass(/editing/);
    await expect(page.getByTestId("camera-editor-modal")).toBeVisible();
    await expect(page.getByRole("heading", { name: "编辑摄像头" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "摄像头名称" }).locator("input")).toHaveValue(firstName);
    await page.getByRole("button", { name: "关闭编辑窗口" }).click();
    await expect(page.getByTestId("camera-editor-modal")).toHaveCount(0);

    await page.getByTestId("camera-create-trigger").click();

    await expect(page.getByTestId("camera-editor-modal")).toBeVisible();
    await expect(page.getByRole("heading", { name: "新建摄像头" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "摄像头名称" }).locator("input")).toHaveValue("");
    await expect(firstItem).not.toHaveClass(/editing/);
  });

  test("点击列表卡片本身不会触发编辑弹窗，只有编辑按钮会触发", async ({ page }) => {
    await loginAsAdmin(page);

    const firstItem = page.getByTestId("camera-list-item").first();
    await firstItem.click();
    await expect(page.getByTestId("camera-editor-modal")).toHaveCount(0);

    await firstItem.getByTestId("camera-edit-trigger").click();
    await expect(page.getByTestId("camera-editor-modal")).toBeVisible();
  });

  test("支持进入单摄像头全屏查看并通过按钮与 ESC 退出", async ({ page }) => {
    await loginAsAdmin(page);
    await ensureAtLeastOneActiveCamera(page);

    const firstTile = page.getByTestId("camera-tile").first();
    const firstName = ((await firstTile.locator("strong").textContent()) || "").trim();

    await firstTile.getByTestId("camera-fullscreen-trigger").click();
    await expect(page.getByTestId("camera-fullscreen")).toBeVisible();
    await expect(page.getByTestId("camera-fullscreen")).toContainText(firstName);
    await expect(page.getByRole("button", { name: "退出全屏" })).toBeVisible();

    await page.getByRole("button", { name: "退出全屏" }).click();
    await expect(page.getByTestId("camera-fullscreen")).toHaveCount(0);

    await firstTile.getByTestId("camera-fullscreen-trigger").click();
    await expect(page.getByTestId("camera-fullscreen")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("camera-fullscreen")).toHaveCount(0);
  });

  test("删除摄像头前会出现二次确认弹层", async ({ page }) => {
    await loginAsAdmin(page);

    const firstItem = page.getByTestId("camera-list-item").first();
    await firstItem.getByTestId("camera-edit-trigger").click();

    const deleteButton = page.getByRole("button", { name: "删除" });
    await deleteButton.click();
    await expect(page.getByTestId("camera-delete-confirm")).toBeVisible();
    await expect(page.getByText("确认删除该摄像头？")).toBeVisible();

    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByTestId("camera-delete-confirm")).toHaveCount(0);
  });
});
