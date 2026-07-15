const STORAGE_INDEX_KEY = 'juchu:index';
const STORAGE_RECORD_PREFIX = 'juchu:record:';

function newRecordKey() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.floor(Math.random() * 1000);
  return `juchu-${stamp}-${rand}`;
}

function loadIndex() {
  try { return JSON.parse(localStorage.getItem(STORAGE_INDEX_KEY)) || []; }
  catch { return []; }
}

function saveIndex(list) {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(list));
}

function loadRecord(key) {
  try { return JSON.parse(localStorage.getItem(STORAGE_RECORD_PREFIX + key)); }
  catch { return null; }
}

function saveRecord(record) {
  record.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_RECORD_PREFIX + record.key, JSON.stringify(record));
  const idx = loadIndex();
  const label = record.label || record.fields?.bukkenRyakushoKanji || record.key;
  const existing = idx.findIndex((r) => r.key === record.key);
  const entry = { key: record.key, label, updatedAt: record.updatedAt };
  if (existing >= 0) idx[existing] = entry; else idx.push(entry);
  saveIndex(idx);
}

function deleteRecord(key) {
  localStorage.removeItem(STORAGE_RECORD_PREFIX + key);
  saveIndex(loadIndex().filter((r) => r.key !== key));
}

function sanitizeFilename(name) {
  return String(name ?? '').replace(/[:*?"<>|]/g, '_');
}

function todayIsoDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ファイル名規則: 受注登録メモ_物件略称_日付_氏名.json （氏名未指定時は氏名部分を省略）
function buildExportFilename(record, submitterName) {
  const label = sanitizeFilename(record.label || record.fields?.bukkenRyakushoKanji || record.key);
  const date = todayIsoDate();
  const name = sanitizeFilename((submitterName || '').trim());
  return `受注登録メモ_${label}_${date}${name ? '_' + name : ''}.json`;
}

async function exportRecordToFile(record, submitterName) {
  const filename = buildExportFilename(record, submitterName);
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return filename;
    } catch (err) {
      if (err.name === 'AbortError') return null; // ユーザーがキャンセル
      // 未対応/失敗時は下のフォールバックへ
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return filename;
}

async function openRecordFromFile(file) {
  const text = await file.text();
  const record = JSON.parse(text);
  if (!record || typeof record !== 'object' || !record.key || typeof record.fields !== 'object' || record.fields === null) {
    throw new Error('受注登録メモのデータファイルではないようです');
  }
  return record;
}
