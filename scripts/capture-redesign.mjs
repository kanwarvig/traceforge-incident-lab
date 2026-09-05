import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const outputDir = path.resolve(process.cwd(), "..", "outputs", "redesign-evidence", "traceforge");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await desktop.goto(`${baseUrl}/lab`, { waitUntil: "networkidle" });
await desktop.getByTestId("inject-fault-header").click();
await desktop.getByTestId("begin-investigation").click();
await desktop.getByTestId("root-hypothesis").click();
await desktop.screenshot({ path: path.join(outputDir, "after-desktop.png") });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.goto(`${baseUrl}/lab`, { waitUntil: "networkidle" });
await mobile.getByTestId("inject-fault-header").click();
await mobile.screenshot({ path: path.join(outputDir, "after-mobile.png") });

await browser.close();
console.log(`Captured responsive evidence in ${outputDir}`);
