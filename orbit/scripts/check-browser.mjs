import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const executablePath =
  process.env.BROWSER_EXECUTABLE ||
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(
    process.env.TEST_APP_URL || "http://127.0.0.1:3000",
    { waitUntil: "networkidle" },
  );
  assert.equal(response.status(), 200);
  assert.ok(
    response.headers()["content-security-policy"].includes("'strict-dynamic'"),
  );
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("orbit-theme")),
    "dark",
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.ok(
    (await page.locator(".inspiration-credit").innerText()).includes(
      "Oh My Dollar Valentine",
    ),
  );
  fs.mkdirSync(".local", { recursive: true });
  await page.screenshot({ path: ".local/orbit-dark.png" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.screenshot({ path: ".local/orbit-light.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile horizontal overflow",
  );
  await page.screenshot({
    path: ".local/orbit-mobile-dark.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: CSP, theme toggle, persisted preference, inspiration credit, mobile width, no page errors.",
  );
  await context.close();
} finally {
  await browser.close();
}
