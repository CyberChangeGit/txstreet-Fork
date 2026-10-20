/* Contract tests for replay transport. No browser, network or external packages. */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("src/replay/replay.js", "utf8")
  .replace("export const replayEnabled =", "const replayEnabled =")
  .replace(/export function /g, "function ");

const timeouts = [];
const intervals = [];
const banner = [];
class Response {
  constructor(body, opts) {
    this._body = body;
    this.status = opts.status;
    this.ok = this.status >= 200 && this.status < 300;
  }
  async json() { return JSON.parse(this._body); }
}
const sandbox = {
  process: { env: { VUE_APP_REPLAY: "true" } },
  window: {},
  document: {
    body: { appendChild(element) { banner.push(element); } },
    createElement() { return { style: {}, textContent: "", id: "" }; }
  },
  Response,
  setTimeout(fn) { timeouts.push(fn); return timeouts.length; },
  setInterval(fn) { intervals.push(fn); return intervals.length; },
  clearInterval() {},
  console
};
vm.runInNewContext(source +
  "\nthis.testAPI = { replayEnabled, installReplayTransport, createReplaySocket };",
  sandbox, { filename: "src/replay/replay.js" });

function flushTimeouts() {
  let guard = 0;
  while (timeouts.length) {
    if (++guard > 200) throw new Error("Infinite timeout queue");
    timeouts.shift()();
  }
}
async function test() {
  const { replayEnabled, installReplayTransport, createReplaySocket } = sandbox.testAPI;
  assert.strictEqual(replayEnabled, true);
  installReplayTransport();
  assert.strictEqual(banner.length, 1);
  assert.match(banner[0].textContent, /SYNTHETIC/);
  const btc = await (await sandbox.window.fetch("http://localhost/static/live/pendingTxs-BTC")).json();
  const eth = await (await sandbox.window.fetch("http://localhost/static/live/pendingTxs-ETH")).json();
  assert.strictEqual(btc.length, 35);
  assert.strictEqual(eth.length, 35);
  assert.match(btc[0].tx, /^[a-f0-9]{64}$/);
  assert.match(eth[0].tx, /^0x[a-f0-9]{64}$/);
  assert.strictEqual((await (await sandbox.window.fetch("http://localhost/static/live/houses-BTC")).json()).length, 0);
  await assert.rejects(sandbox.window.fetch("https://example.com/unauthorized"), /blocked/);

  const socket = createReplaySocket("BTC");
  let latest = null;
  let stats = null;
  const txs = [];
  let minedBlock = null;
  socket.once("latestblocks", data => { latest = data; });
  socket.on("stat-updates", (_, key, value) => { stats = { key, value }; });
  socket.on("tx", data => { txs.push(data); });
  socket.on("block", data => { minedBlock = data; });
  socket.emit("join-room", "BTC-blocks");
  socket.emit("join-room", "BTC-transactions");
  socket.emit("fetch-stat", "BTC", null, { key: "medianFee-satPerByte" });
  flushTimeouts();
  assert.strictEqual(latest.length, 3);
  assert.strictEqual(latest[2].height, latest[1].height + 1);
  assert.strictEqual(stats.key, "medianFee-satPerByte");
  assert.strictEqual(stats.value, 14);
  for (let i = 0; i < 7; i++) intervals[1]();
  assert.strictEqual(txs.length, 7);
  intervals[0]();
  assert.strictEqual(minedBlock.height, latest[2].height + 1);
  assert.strictEqual(Object.keys(minedBlock.txFull).length, 6);
  const ethSocket = createReplaySocket("ETH");
  let ethStat;
  ethSocket.on("stat-updates", (_, key, value) => { ethStat = value; });
  ethSocket.emit("fetch-stat", "ETH", null, { key: "gasUsedDif" });
  flushTimeouts();
  assert.strictEqual(ethStat, 100);
  socket.disconnect();
  ethSocket.disconnect();
  console.log("Replay transport contract tests passed.");
}
test().catch(err => { console.error(err); process.exitCode = 1; });
