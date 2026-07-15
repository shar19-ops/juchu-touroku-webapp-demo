const LOCAL_CUSTOMERS_KEY = 'juchu:customers:local';

function loadLocalCustomers() {
  try { return JSON.parse(localStorage.getItem(LOCAL_CUSTOMERS_KEY)) || []; }
  catch { return []; }
}

function saveLocalCustomers(list) {
  localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(list));
}

function makeSearchIndex(loadFn) {
  let items = null;
  let loadingPromise = null;

  async function ensureLoaded() {
    if (items) return;
    if (!loadingPromise) loadingPromise = loadFn().then((data) => { items = data; });
    await loadingPromise;
  }

  return { ensureLoaded, getItems: () => items };
}

const CustomerMaster = (() => {
  const staticIndex = makeSearchIndex(async () => {
    const res = await fetch('data/customers.json');
    if (!res.ok) throw new Error(`得意先マスタの読み込みに失敗しました (HTTP ${res.status})`);
    return res.json();
  });

  async function load() {
    await staticIndex.ensureLoaded();
  }

  function search(query, limit = 20) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const master = (staticIndex.getItems() || []).map((c) => ({ ...c, source: 'master' }));
    const local = loadLocalCustomers().map((c) => ({ ...c, source: 'local' }));
    const merged = new Map();
    for (const c of master) merged.set(c.code, c);
    for (const c of local) merged.set(c.code, c); // local wins on same code
    const results = [];
    for (const c of merged.values()) {
      if (c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) {
        results.push(c);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  function addLocal(code, name) {
    const list = loadLocalCustomers();
    const idx = list.findIndex((c) => c.code === code);
    const entry = { code, name };
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    saveLocalCustomers(list);
  }

  return { load, search, addLocal };
})();

const StaffMaster = (() => {
  const idx = makeSearchIndex(async () => {
    const res = await fetch('data/staff.json');
    if (!res.ok) throw new Error(`担当者マスタの読み込みに失敗しました (HTTP ${res.status})`);
    return res.json();
  });

  async function load() { await idx.ensureLoaded(); }

  function search(query, limit = 20) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const items = idx.getItems() || [];
    const results = [];
    for (const s of items) {
      if (s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) {
        results.push(s);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  return { load, search };
})();

const PrefectureMaster = (() => {
  const idx = makeSearchIndex(async () => {
    const res = await fetch('data/prefectures.json');
    if (!res.ok) throw new Error(`都道府県市区町村マスタの読み込みに失敗しました (HTTP ${res.status})`);
    const raw = await res.json();
    return raw.map((r) => ({ ...r, display: `${r.todoufukenName}${r.shikuchousonName || ''}` }));
  });

  async function load() { await idx.ensureLoaded(); }

  function search(query, limit = 20) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const items = idx.getItems() || [];
    const results = [];
    for (const p of items) {
      if (p.display.toLowerCase().includes(q)) {
        results.push(p);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  return { load, search };
})();
