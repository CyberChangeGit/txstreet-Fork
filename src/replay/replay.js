/*
 * BlockchainTruth isolated transaction replay.
 * Synthetic records only. Do not use for performance or finality comparisons.
 * Activated only by VUE_APP_REPLAY=true.
 */
export const replayEnabled = process.env.VUE_APP_REPLAY === "true";

const BASE_HEIGHT = { BTC: 840000, ETH: 20000000 };
const START_TIME = 1760000000;
const supported = ["BTC", "ETH"];
const sockets = new Set();
const makeHash = (ticker, counter) =>
  (ticker === "ETH" ? "0x" : "") +
  (ticker === "ETH" ? "e" : "b") +
  counter.toString(16).padStart(63, "0");

function transaction(ticker, index) {
  if (ticker === "ETH") {
    const sender = "0x" + index.toString(16).padStart(40, "0");
    return {
      tx: makeHash(ticker, 10000 + index),
      fr: sender,
      to: "0x" + (index + 100).toString(16).padStart(40, "0"),
      ty: 2, n: index, an: index,
      g: 21000 + (index % 4) * 10000,
      gp: 3000000000,
      mfpg: (3 + (index % 6)) * 1000000000,
      mpfpg: (1 + (index % 3)) * 1000000000,
      t: START_TIME + index * 3,
      tot: 0.01
    };
  }
  return {
    tx: makeHash(ticker, 20000 + index),
    s: 230 + (index % 5) * 80,
    rs: 170 + (index % 5) * 60,
    spb: 3 + (index % 16) * 2,
    t: START_TIME + index * 7,
    tot: 0.003
  };
}

const state = {};
function getState(ticker) {
  if (!state[ticker]) {
    const initial = [];
    const height = BASE_HEIGHT[ticker] || 100;
    for (let i = 0; i < 3; i++) {
      const full = {};
      for (let j = 0; j < 4; j++) {
        const tx = transaction(ticker, 500 + i * 4 + j);
        full[tx.tx] = tx;
      }
      initial.push({
        coin: ticker,
        hash: makeHash(ticker, 100 + i),
        parentHash: makeHash(ticker, 99 + i),
        height: height + i,
        time: START_TIME + i * (ticker === "ETH" ? 12 : 600),
        inserted: START_TIME + i * (ticker === "ETH" ? 12 : 600),
        size: 850000, s: 850000,
        gu: 14000000, gl: 30000000, baseFee: 2000000000,
        txFull: full, txs: 4
      });
    }
    state[ticker] = {
      seq: 1,
      blocks: initial,
      newTransactions: [],
      lastBlock: initial[initial.length - 1]
    };
  }
  return state[ticker];
}

function pending(ticker) {
  return Array.from({ length: 35 }, (_, i) => transaction(ticker, i + 1));
}

const statistics = {
  "gasUsedDif": 100,
  "gasTarget": 15000000,
  "gasLimit": 30000000,
  "baseFee": 2000000000,
  "medianFee-gasPrice": 4000000000,
  "medianFee-satPerByte": 14,
  "medianBlockTime": 12,
  "tps": 15,
  "ctps": 12,
  "mempool-size": 35,
  "mempool-bytes": 150000,
  "gasEstimate": 3000000000,
  "tipPrice": 1000000000,
  "blockHeight": 20000002
};
function statValue(ticker, key) {
  if (key === "medianBlockTime") return ticker === "BTC" ? 600 : 12;
  if (key === "tps") return ticker === "BTC" ? 4 : 15;
  if (key === "blockHeight") return getState(ticker).lastBlock.height;
  return Object.prototype.hasOwnProperty.call(statistics, key) ? statistics[key] : 0;
}

class ReplaySocket {
  constructor(ticker) {
    this.ticker = ticker;
    this.connected = true;
    this.handlers = {};
    this.rooms = new Set();
    this.pendingTimer = null;
    this.blockTimer = null;
    sockets.add(this);
  }
  on(name, callback) {
    (this.handlers[name] || (this.handlers[name] = [])).push({ callback, once: false });
    return this;
  }
  once(name, callback) {
    (this.handlers[name] || (this.handlers[name] = [])).push({ callback, once: true });
    return this;
  }
  off(name, callback) {
    if (this.handlers[name]) {
      this.handlers[name] = this.handlers[name].filter(entry => entry.callback !== callback);
    }
    return this;
  }
  removeListener(name, callback) { return this.off(name, callback); }
  removeAllListeners(name) {
    if (name) delete this.handlers[name];
    else this.handlers = {};
    return this;
  }
  notify(name, ...args) {
    const list = (this.handlers[name] || []).slice();
    for (const entry of list) {
      if (entry.once) this.off(name, entry.callback);
      entry.callback(...args);
    }
  }
  emit(name, ...args) {
    if (name === "join-room") {
      const room = args[0];
      this.rooms.add(room);
      if (room === this.ticker + "-blocks") {
        setTimeout(() => this.notify("latestblocks", getState(this.ticker).blocks.slice()), 80);
        this.startBlocks();
      }
      if (room === this.ticker + "-transactions") this.startTransactions();
    }
    if (name === "leave-room") this.rooms.delete(args[0]);
    if (name === "fetch-stat") {
      const ticker = args[0];
      const key = args[2] && args[2].key;
      if (key) {
        setTimeout(() => this.notify("stat-updates", ticker, key, statValue(ticker, key)), 120);
      }
    }
    if (name === "get-recent-house-txs") {
      setTimeout(() => this.notify("get-recent-house-txs", args[0], null, []), 100);
    }
    if (name === "fetch-block") {
      const hash = args[1];
      const block = getState(this.ticker).blocks.find(b => b.hash === hash);
      setTimeout(() => this.notify("fetch-block", hash, block ? null : "not found", block || null), 60);
    }
    return this;
  }
  startTransactions() {
    if (this.pendingTimer) return;
    this.pendingTimer = setInterval(() => {
      if (!this.rooms.has(this.ticker + "-transactions")) return;
      const current = getState(this.ticker);
      const tx = transaction(this.ticker, 1000 + current.seq++);
      current.newTransactions.push(tx);
      this.notify("tx", { ...tx });
    }, 1150);
  }
  startBlocks() {
    if (this.blockTimer) return;
    this.blockTimer = setInterval(() => {
      if (!this.rooms.has(this.ticker + "-blocks")) return;
      const current = getState(this.ticker);
      const previous = current.lastBlock;
      const included = current.newTransactions.splice(0, 6);
      const full = {};
      for (const tx of included) full[tx.tx] = tx;
      const block = {
        coin: this.ticker,
        hash: makeHash(this.ticker, 40000 + current.seq),
        parentHash: previous.hash,
        height: previous.height + 1,
        time: previous.time + (this.ticker === "BTC" ? 600 : 12),
        inserted: previous.time + (this.ticker === "BTC" ? 600 : 12),
        size: 800000, s: 800000,
        gu: 14000000, gl: 30000000, baseFee: 2000000000,
        txFull: full, txs: included.length
      };
      current.blocks.push(block);
      current.lastBlock = block;
      this.notify("block", block);
    }, this.ticker === "BTC" ? 28000 : 13500);
  }
  disconnect() {
    this.connected = false;
    clearInterval(this.pendingTimer);
    clearInterval(this.blockTimer);
    sockets.delete(this);
    this.notify("disconnect");
  }
}

export function createReplaySocket(ticker) {
  if (!supported.includes(ticker)) throw new Error("Replay supports BTC/ETH only");
  return new ReplaySocket(ticker);
}

function replayData(url) {
  const path = String(url);
  const house = path.match(/\/static\/live\/houses-([A-Z]+)/);
  if (house) return [];
  const txs = path.match(/\/static\/live\/pendingTxs-([A-Z]+)/);
  if (txs) return pending(txs[1]);
  const block = path.match(/\/static\/blocks\/([A-Z]+)\/([^?]+)/);
  if (block) return getState(block[1]).blocks.find(b => b.hash === block[2]) || null;
  if (path.includes("/api/currentAd")) return [];
  if (path.includes("/static/live/")) return [];
  if (path.includes("/api/v2/")) return [];
  throw new Error("Replay mode blocked an unrecognized network fetch: " + path);
}

export function installReplayTransport() {
  if (!replayEnabled) return;
  window.fetch = async function(input) {
    const url = typeof input === "string" ? input : input.url;
    const data = replayData(url);
    return new Response(JSON.stringify(data), {
      status: data === null ? 404 : 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  window.__txstreetReplay = {
    synthetic: true,
    supported: supported.slice(),
    sockets
  };
  const banner = document.createElement("div");
  banner.id = "blockchaintruth-replay-banner";
  banner.textContent = "BLOCKCHAINTRUTH REPLAY | SYNTHETIC BTC/ETH EVENTS | NOT LIVE CHAIN DATA";
  Object.assign(banner.style, {
    position: "fixed", top: "0", left: "0", right: "0",
    zIndex: "99999", padding: "7px 12px", textAlign: "center",
    background: "#142437", color: "#ffffff", font: "600 12px Arial",
    pointerEvents: "none"
  });
  document.body.appendChild(banner);
}
