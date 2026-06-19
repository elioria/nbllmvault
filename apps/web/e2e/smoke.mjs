import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:5174";
const SHOT_DIR = process.env.E2E_SHOTS ?? "/tmp/nbllm-shots";
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

try {
  log("load home");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("text=nbllmvault");
  await page.screenshot({ path: `${SHOT_DIR}/1-home.png` });

  log("create notebook");
  await page.click("text=New notebook");
  await page.fill('input[placeholder^="e.g."]', "E2E Smoke Notebook");
  await page.click("button:has-text('Create')");
  await page.waitForSelector("text=Sources", { timeout: 15000 });
  await page.screenshot({ path: `${SHOT_DIR}/2-notebook.png` });

  log("add a paste note");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("tab", { name: "Paste" }).click();
  await dialog.locator('input[placeholder="Note title"]').fill("Photosynthesis");
  await dialog
    .locator('textarea[placeholder^="Paste or type"]')
    .fill(
      "Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs sunlight in the chloroplasts. The light reactions produce ATP and NADPH. The Calvin cycle fixes carbon dioxide into glucose."
    );
  await dialog.getByRole("button", { name: "Add note" }).click();
  await page.waitForSelector("text=Photosynthesis", { timeout: 15000 });
  log("source added");

  log("compile");
  await page.click("button:has-text('Compile wiki')");
  await page.waitForSelector("text=/Compiled · \\d+ pages/", { timeout: 60000 });
  await page.screenshot({ path: `${SHOT_DIR}/3-compiled.png` });
  log("compiled");

  // Wait for pages to appear in the reader
  await page.waitForSelector("text=Wiki pages", { timeout: 5000 });
  await page.waitForFunction(
    () => document.body.innerText.match(/Wiki pages[\s\S]*?\b([1-9]\d*)\b/),
    { timeout: 10000 }
  );

  log("open a wiki page");
  // Page rows are buttons in main that contain a page title; pick the
  // 'photosynthesis' concept page row specifically.
  await page
    .locator("main button", { hasText: "photosynthesis" })
    .first()
    .click();
  await page.getByRole("button", { name: "Back" }).waitFor({ timeout: 8000 });
  await page.screenshot({ path: `${SHOT_DIR}/4-page.png` });
  await page.click("button:has-text('Back')");

  log("ask a grounded question");
  const chatBox = page.locator('textarea[placeholder="Ask a question…"]');
  await chatBox.fill("What does chlorophyll do?");
  await chatBox.press("Enter");
  await page.waitForFunction(
    () => document.querySelectorAll(".md-prose").length > 0,
    { timeout: 60000 }
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/5-chat.png` });
  log("chat answered");

  const bodyText = await page.evaluate(() => document.body.innerText);
  const ok =
    bodyText.includes("E2E Smoke Notebook") &&
    bodyText.includes("Photosynthesis") &&
    /chlorophyll/i.test(bodyText);

  if (errors.length) {
    console.log("\nConsole/page errors:");
    for (const e of errors.slice(0, 10)) console.log("  ✗", e);
  }

  if (ok) {
    console.log("\n✅ E2E PASS — full NotebookLM flow worked in the browser");
    process.exitCode = 0;
  } else {
    console.log("\n❌ E2E assertions failed");
    process.exitCode = 1;
  }
} catch (err) {
  console.error("\n❌ E2E ERROR:", err.message);
  await page.screenshot({ path: `${SHOT_DIR}/error.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
