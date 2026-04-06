import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000";
const ADMIN_EMAIL = "admin@school.local";
const ADMIN_PASSWORD = "Admin12345";

function uniqueUnknownEmail(prefix = "log-autotest") {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `${prefix}-${stamp}@example.com`;
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
  await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
}

async function openLogsPage(page) {
  await page.getByRole("button", { name: "事件日志" }).click();
  await expect(page.getByRole("heading", { name: "事件日志" })).toBeVisible();
}

async function seedForgotPasswordLogs(request, count = 1) {
  for (let index = 0; index < count; index += 1) {
    const response = await request.post(`${API_BASE}/api/auth/forgot-password`, {
      data: { email: uniqueUnknownEmail(`logs-${index}`) },
    });
    expect(response.ok()).toBeTruthy();
  }
}

async function refreshLogs(page) {
  await page.getByRole("button", { name: "刷新" }).click();
  await expect(page.locator(".log-row").first()).toBeVisible();
}

test.describe("日志页自动化", () => {
  test("支持按认证来源与关键词筛选日志", async ({ page, request }) => {
    await seedForgotPasswordLogs(request, 3);
    await loginAsAdmin(page);
    await openLogsPage(page);

    await page.locator(".log-toolbar .search-box input").fill("unknown account");
    await page.locator(".log-toolbar select").nth(2).selectOption("auth");
    await refreshLogs(page);

    await expect(page.locator(".log-source").first()).toHaveText("auth");
    await expect(page.locator(".log-text").first()).toContainText("Forgot password requested for unknown account");
  });

  test("支持按请求来源分页浏览日志", async ({ page, request }) => {
    await seedForgotPasswordLogs(request, 12);
    await loginAsAdmin(page);
    await openLogsPage(page);

    await page.locator(".log-toolbar .search-box input").fill("/api/auth/forgot-password");
    await page.locator(".log-toolbar select").nth(2).selectOption("http");
    await page.locator(".log-toolbar select").nth(3).selectOption("10");
    await refreshLogs(page);

    const firstPageFirstText = (await page.locator(".log-text").first().textContent()) || "";
    await expect(page.locator(".log-row")).toHaveCount(10);
    await expect(page.locator(".log-pagination-info")).toContainText("第 1 /");

    const nextButton = page.getByRole("button", { name: "下一页" });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await expect(page.locator(".log-pagination-info")).toContainText("第 2 /");
    await expect(page.locator(".log-source").first()).toHaveText("http");
    await expect(page.locator(".log-text").first()).not.toHaveText(firstPageFirstText);
  });
});
