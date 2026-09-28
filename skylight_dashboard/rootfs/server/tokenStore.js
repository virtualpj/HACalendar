const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const FILE = path.join(DATA_DIR, 'accounts.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(FILE)) return { accounts: [] };
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    console.error('Failed reading accounts.json, starting fresh:', e.message);
    return { accounts: [] };
  }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getAccounts() {
  return load().accounts;
}

function getAccount(id) {
  return load().accounts.find(a => a.id === id);
}

function upsertAccount(account) {
  const data = load();
  const idx = data.accounts.findIndex(a => a.id === account.id);
  if (idx >= 0) data.accounts[idx] = { ...data.accounts[idx], ...account };
  else data.accounts.push(account);
  save(data);
  return account;
}

function removeAccount(id) {
  const data = load();
  data.accounts = data.accounts.filter(a => a.id !== id);
  save(data);
}

module.exports = { getAccounts, getAccount, upsertAccount, removeAccount };
