import { existsSync, readdirSync, statSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:5175";
const SHOT_DIR = process.env.E2E_SHOTS ?? "/tmp/nbllm-shots";
const DL_DIR = "/tmp/nbllm-downloads";
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();

try {
  log("load + create notebook with a source");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click("text=New notebook");
  await page.fill('input[placeholder^="e.g."]', "Export E2E");
  await page.click("button:has-text('Create')");
  await page.waitForSelector("text=Sources", { timeout: 15000 });

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("tab", { name: "Paste" }).click();
  await dialog.locator('input[placeholder="Note title"]').fill("Volcanoes");
  await dialog
    .locator('textarea[placeholder^="Paste or type"]')
    .fill("Volcanoes form where magma reaches the surface. Tectonic plate boundaries host most volcanic activity. Eruptions release ash, lava, and gases.");
  await dialog.getByRole("button", { name: "Add note" }).click();
  await page.waitForSelector("text=Volcanoes", { timeout: 15000 });

  log("compile");
  await page.click("button:has-text('Compile wiki')");
  await page.waitForSelector("text=/Compiled · \\d+ pages/", { timeout: 60000 });

  log("open export menu");
  await page.getByRole("button", { name: "Export" }).click();
  await page.waitForSelector("text=Take your data with you", { timeout: 5000 });
  await page.screenshot({ path: `${SHOT_DIR}/6-export-menu.png` });

  log("download full vault");
  const dlPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.getByText("Full vault (.zip)").click();
  const download = await dlPromise;
  const suggested = download.suggestedFilename();
  const dest = `${DL_DIR}/${suggested}`;
  await download.saveAs(dest);

  const ok = existsSync(dest) && statSync(dest).size > 1000 && suggested.endsWith(".zip");
  log(`downloaded: ${suggested} (${ok ? statSync(dest).size + " bytes" : "MISSING"})`);

  if (ok) {
    console.log("\n✅ EXPORT E2E PASS — user downloaded their full vault from the UI");
    console.log("   files in", DL_DIR, ":", readdirSync(DL_DIR));
    process.exitCode = 0;
  } else {
    console.log("\n❌ EXPORT E2E FAIL");
    process.exitCode = 1;
  }
} catch (err) {
  console.error("\n❌ EXPORT E2E ERROR:", err.message);
  await page.screenshot({ path: `${SHOT_DIR}/export-error.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
