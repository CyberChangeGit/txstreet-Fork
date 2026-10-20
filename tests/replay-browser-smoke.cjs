/* Headless rendering smoke test for the isolated replay build.
 * Run with NODE_PATH pointing to playwright-core and a local Chrome installation.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");

const dist = path.resolve(__dirname, "../dist");
const output = path.resolve(__dirname, "../smoke-artifacts");
fs.mkdirSync(output, { recursive: true });
const types = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".ico": "image/x-icon"
};
const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = path.resolve(dist, "." + requestPath);
  const file = safePath.startsWith(dist + path.sep) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()
    ? safePath : path.join(dist, "index.html");
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
function chromePath() {
  return [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(p => p && fs.existsSync(p));
}
async function run() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    const executablePath = chromePath();
    assert(executablePath, "Chromium/Chrome not available in CI runner");
    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
    await page.goto("http://127.0.0.1:" + server.address().port + "/v/btc-eth/launch", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#blockchaintruth-replay-banner", { timeout: 15000 });
    await page.waitForSelector("canvas", { timeout: 45000 });
    await page.waitForTimeout(7000);
    const dimensions = await page.locator("canvas").first().evaluate(c => ({ width: c.width, height: c.height }));
    await page.screenshot({ path: path.join(output, "btc-eth-replay.png"), fullPage: true });
    fs.writeFileSync(path.join(output, "diagnostics.json"), JSON.stringify({ dimensions, errors }, null, 2));
    assert(dimensions.width >= 320 && dimensions.height >= 320, "Canvas dimensions are too small");
    assert.strictEqual(errors.length, 0, errors.join("\n"));
    console.log("Browser render smoke test passed. Canvas:", dimensions);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
