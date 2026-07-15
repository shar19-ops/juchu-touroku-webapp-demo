const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const APP_VERSION = '1.1.0';

let currentRecord = null;
let autosaveTimer = null;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    if (!currentRecord) return;
    currentRecord.label = currentRecord.fields.bukkenRyakushoKanji || currentRecord.key;
    saveRecord(currentRecord);
    $('#saveStatus').textContent = '自動保存しました（' + new Date().toLocaleTimeString('ja-JP') + '）';
    $('#saveStatus').classList.remove('error');
  }, 800);
}

function flushAutosave() {
  if (autosaveTimer && currentRecord) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    currentRecord.label = currentRecord.fields.bukkenRyakushoKanji || currentRecord.key;
    saveRecord(currentRecord);
  }
}

function closeAppWindow() {
  window.close();
  setTimeout(() => {
    if (!window.closed) {
      const el = $('#saveStatus');
      if (el) el.textContent += '（自動で閉じられない場合は、このタブを手動で閉じてください）';
    }
  }, 300);
}

// 01.受注計上年月の初期値: 起票日基準、起票日が11日以降なら翌月に繰り上げる
function defaultJuchuKeijoYearMonth(date = new Date()) {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  if (date.getDate() >= 11) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return `${year}年${String(month).padStart(2, '0')}月`;
}

function newRecord() {
  return {
    schemaVersion: 1,
    key: newRecordKey(),
    label: '',
    fields: { juchuKeijoYearMonth: defaultJuchuKeijoYearMonth() },
    attachments: {},
    stampSlots: [],
    stampFlow: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderProjectSelect() {
  const sel = $('#projectSelect');
  const idx = loadIndex().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  sel.innerHTML = '<option value="">-- 保存済みの案件を選択 --</option>' +
    idx.map((r) => `<option value="${r.key}">${escapeFieldHtml(r.label)}</option>`).join('');
  updateDeleteRecordButtonState();
}

function updateDeleteRecordButtonState() {
  const btn = $('#deleteRecordBtn');
  if (btn) btn.disabled = !$('#projectSelect').value;
}

function showMainView() {
  resetAdminUnlock();
  $('#mainView').hidden = false;
  ensureStampSlots(currentRecord);
  ensureStampFlow(currentRecord);
  refreshMainView();
}

function refreshMainView() {
  renderForm(currentRecord);
  renderAttachments(currentRecord);
  renderStampInputs(currentRecord);
  renderStampBoxes(currentRecord);
  applyLockState(currentRecord);
}

async function openRecordByKey(key) {
  const record = loadRecord(key);
  if (!record) return;
  flushAutosave();
  currentRecord = record;
  showMainView();
}

$('#newRecordBtn').addEventListener('click', () => {
  flushAutosave();
  currentRecord = newRecord();
  saveRecord(currentRecord);
  renderProjectSelect();
  $('#projectSelect').value = currentRecord.key;
  updateDeleteRecordButtonState();
  showMainView();
});

$('#projectSelect').addEventListener('change', (e) => {
  updateDeleteRecordButtonState();
  if (e.target.value) openRecordByKey(e.target.value);
});

$('#deleteRecordBtn').addEventListener('click', () => {
  const sel = $('#projectSelect');
  const key = sel.value;
  if (!key) return;
  const label = sel.options[sel.selectedIndex]?.textContent || key;
  const ok = confirm(`「${label}」を削除します。この操作は元に戻せません。よろしいですか？`);
  if (!ok) return;
  deleteRecord(key);
  if (currentRecord && currentRecord.key === key) {
    currentRecord = null;
    $('#mainView').hidden = true;
  }
  renderProjectSelect();
  sel.value = '';
  updateDeleteRecordButtonState();
  $('#saveStatus').textContent = `「${label}」を削除しました`;
  $('#saveStatus').classList.remove('error');
});

$('#openFileBtn').addEventListener('click', () => $('#openFileInput').click());
$('#openFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    flushAutosave();
    currentRecord = await openRecordFromFile(file);
    saveRecord(currentRecord);
    renderProjectSelect();
    $('#projectSelect').value = currentRecord.key;
  updateDeleteRecordButtonState();
    showMainView();
    $('#saveStatus').textContent = `ファイルから開きました（${file.name}）`;
    $('#saveStatus').classList.remove('error');
  } catch (err) {
    alert('ファイルを開けませんでした: ' + err.message);
  }
});

$('#exportFileBtn').addEventListener('click', async () => {
  if (!currentRecord) return;
  flushAutosave();
  const filename = await exportRecordToFile(currentRecord);
  if (filename) {
    $('#saveStatus').textContent = `ファイルに保存しました（${filename}）`;
    $('#saveStatus').classList.remove('error');
  }
});

$('#printBtn').addEventListener('click', async () => {
  if (!currentRecord) return;
  buildPrintSheet(currentRecord);
  // フッターロゴ画像の読み込みが非同期のため、完了前にwindow.print()すると
  // 画像が空欄のまま印刷されてしまう。読み込み完了を待ってから印刷する。
  const logoImg = $('.print-footer-logo');
  if (logoImg && !logoImg.complete) {
    await new Promise((resolve) => {
      logoImg.addEventListener('load', resolve, { once: true });
      logoImg.addEventListener('error', resolve, { once: true });
    });
  }
  window.print();
});

// PWAとしてインストールされている場合、.jsonファイルのダブルクリックから直接起動できる
if ('launchQueue' in window && window.LaunchParams && 'files' in window.LaunchParams.prototype) {
  window.launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files || !launchParams.files.length) return;
    const file = await launchParams.files[0].getFile();
    currentRecord = await openRecordFromFile(file);
    saveRecord(currentRecord);
    renderProjectSelect();
    $('#projectSelect').value = currentRecord.key;
  updateDeleteRecordButtonState();
    showMainView();
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------------- 初期化 ----------------
const appVersionEl = $('#appVersion');
if (appVersionEl) appVersionEl.textContent = `v${APP_VERSION}`;

if (DEMO_MODE) {
  const banner = $('#demoBanner');
  if (banner) {
    banner.hidden = false;
    banner.textContent = '🧪 これはデモ版です。得意先・担当者データはすべてサンプルであり、実在する企業・個人とは関係ありません。操作性の確認・レビュー用にご利用ください。';
  }
}

(async () => {
  try {
    await Promise.all([CustomerMaster.load(), StaffMaster.load(), PrefectureMaster.load()]);
    renderProjectSelect();
  } catch (err) {
    const el = $('#bootError');
    if (el) {
      el.textContent = 'マスタデータの読み込みに失敗しました。ページを再読み込みしてください。（' + err.message + '）';
      el.hidden = false;
    }
  }
})();
