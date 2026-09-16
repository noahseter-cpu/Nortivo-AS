import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 8000 },
  use: {
    baseURL: process.env.TEST_URL ?? "http://localhost:5174",
    headless: true,
    launchOptions: {
      executablePath:
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    },
  },
  reporter: "list",
  workers: 1,
  outputDir: ".sites-runtime/test-results",
});
