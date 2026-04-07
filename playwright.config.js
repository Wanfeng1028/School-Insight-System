import { defineConfig, devices } from "@playwright/test";

const backendCommand =
  process.env.PLAYWRIGHT_BACKEND_COMMAND ||
  (process.platform === "win32"
    ? "py -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
    : "python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000");

export default defineConfig({
  testDir: "./automation",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: backendCommand,
      cwd: "./backend",
      url: "http://127.0.0.1:8000/docs",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
