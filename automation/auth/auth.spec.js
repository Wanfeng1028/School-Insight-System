import { expect, test } from "@playwright/test";

function uniqueUser(prefix = "autotest") {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: `${prefix}-${stamp}`,
    email: `${prefix}-${stamp}@example.com`,
    password: "AutoTest123",
    nextPassword: "ResetPass123",
  };
}

async function gotoAuthPage(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "轨迹分析控制台" }).first()).toBeVisible();
}

async function switchAuthMode(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".auth-panel h2")).toHaveText(name);
}

async function fillInputByLabel(page, label, value, index = 0) {
  const field = page.locator("label").filter({ hasText: label }).nth(index).locator("input");
  await field.fill(value);
}

async function submitAuth(page, action) {
  await page.getByRole("button", { name: action }).click();
}

async function logout(page) {
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("heading", { name: "轨迹分析控制台" }).first()).toBeVisible();
}

test.describe("认证页自动化", () => {
  test("支持切换登录、注册、忘记密码、重置密码视图", async ({ page }) => {
    await gotoAuthPage(page);

    await expect(page.getByText("演示账号")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "返回登录" })).toHaveCount(0);
    await expect(page.locator("label").filter({ hasText: "邮箱" }).locator("input")).toHaveValue("");
    await expect(page.locator("label").filter({ hasText: "密码" }).locator("input")).toHaveValue("");

    await switchAuthMode(page, "注册");
    await expect(page.locator("label").filter({ hasText: "姓名" }).locator("input")).toBeVisible();

    await switchAuthMode(page, "忘记密码");
    await expect(page.locator("label").filter({ hasText: "邮箱" }).locator("input")).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "密码" }).locator("input")).toHaveCount(0);

    await switchAuthMode(page, "重置密码");
    await expect(page.locator("label").filter({ hasText: "验证码" }).locator("input")).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "确认密码" }).locator("input")).toBeVisible();

    await switchAuthMode(page, "登录");
    await expect(page.locator("label").filter({ hasText: "邮箱" }).locator("input")).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "密码" }).locator("input")).toBeVisible();
  });

  test("错误密码登录会提示失败", async ({ page }) => {
    await gotoAuthPage(page);
    await fillInputByLabel(page, "邮箱", "admin@school.local");
    await fillInputByLabel(page, "密码", "WrongPass123");
    await submitAuth(page, "进入系统");
    await expect(page.locator(".auth-message")).toContainText("邮箱或密码错误。");
  });

  test("注册成功后自动登录并支持退出", async ({ page }) => {
    const user = uniqueUser("register");

    await gotoAuthPage(page);
    await switchAuthMode(page, "注册");
    await fillInputByLabel(page, "姓名", user.name);
    await fillInputByLabel(page, "邮箱", user.email);
    await fillInputByLabel(page, "密码", user.password);
    await fillInputByLabel(page, "确认密码", user.password);
    await submitAuth(page, "创建账号");

    await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
    await expect(page.locator(".user-name")).toContainText(user.name);

    await logout(page);
  });

  test("弱密码注册会显示校验提示", async ({ page }) => {
    const user = uniqueUser("weak");

    await gotoAuthPage(page);
    await switchAuthMode(page, "注册");
    await fillInputByLabel(page, "姓名", user.name);
    await fillInputByLabel(page, "邮箱", user.email);
    await fillInputByLabel(page, "密码", "weakpass");
    await fillInputByLabel(page, "确认密码", "weakpass");
    await submitAuth(page, "创建账号");

    await expect(page.locator(".auth-message")).toContainText("密码需包含大写字母。");
  });

  test("忘记密码与重置密码后可使用新密码登录", async ({ page }) => {
    const user = uniqueUser("reset");

    await gotoAuthPage(page);
    await switchAuthMode(page, "注册");
    await fillInputByLabel(page, "姓名", user.name);
    await fillInputByLabel(page, "邮箱", user.email);
    await fillInputByLabel(page, "密码", user.password);
    await fillInputByLabel(page, "确认密码", user.password);
    await submitAuth(page, "创建账号");
    await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
    await logout(page);

    await switchAuthMode(page, "忘记密码");
    await fillInputByLabel(page, "邮箱", user.email);
    await submitAuth(page, "发送验证码");
    await expect(page.locator(".auth-message")).toContainText("验证码：");

    const codeMatch = (await page.locator(".auth-message").textContent())?.match(/验证码：([^，]+)/);
    expect(codeMatch?.[1]).toBeTruthy();

    await expect(page.locator(".auth-panel h2")).toHaveText("重置密码");
    await fillInputByLabel(page, "邮箱", user.email);
    await fillInputByLabel(page, "验证码", codeMatch[1]);
    await fillInputByLabel(page, "密码", user.nextPassword, 0);
    await fillInputByLabel(page, "确认密码", user.nextPassword);
    await submitAuth(page, "更新密码");
    await expect(page.locator(".auth-message")).toContainText("密码已更新，请重新登录。");

    await fillInputByLabel(page, "邮箱", user.email);
    await fillInputByLabel(page, "密码", user.nextPassword);
    await submitAuth(page, "进入系统");
    await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
  });
});
