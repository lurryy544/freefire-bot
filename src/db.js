const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

const defaultData = { states: {}, orders: [] };

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function getState(userId) {
  return load().states[String(userId)] || null;
}

function setState(userId, state) {
  const data = load();
  data.states[String(userId)] = state;
  save(data);
}

function clearState(userId) {
  const data = load();
  delete data.states[String(userId)];
  save(data);
}

function addOrder(userId, order) {
  const data = load();
  data.orders.unshift({ ...order, createdAt: new Date().toISOString() });
  save(data);
}

function getOrders() {
  return load().orders;
}

module.exports = { getState, setState, clearState, addOrder, getOrders };