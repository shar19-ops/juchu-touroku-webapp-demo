const STAMP_SLOT_COUNT = 3;
const STAMP_SLOT_LABELS = ['発行者', '確認1', '確認2'];
const STAMP_TITLES = ['', '副長', '課長', '工事長', '支店長', '部長', '本部長', '取締役', '常務', '本店長'];
const STAMP_TITLE_COLOR = {
  '': 'black', '副長': 'black', '課長': 'black',
  '工事長': 'red', '支店長': 'red', '部長': 'red', '本部長': 'red', '取締役': 'red', '常務': 'red', '本店長': 'red',
};

function newStampSlot() { return { name: '', title: '', date: '' }; }

function ensureStampSlots(record) {
  const prev = Array.isArray(record.stampSlots) ? record.stampSlots : [];
  record.stampSlots = Array.from({ length: STAMP_SLOT_COUNT }, (_, i) => prev[i] || newStampSlot());
}

function ensureStampFlow(record) {
  if (record.stampFlow && typeof record.stampFlow.stage === 'number') return;
  const slots = record.stampSlots;
  let stage = 0;
  while (stage < STAMP_SLOT_COUNT && (slots[stage]?.name || '').trim()) stage++;
  record.stampFlow = { stage, skipped: [] };
}

function stampSlotState(record, i) {
  const flow = record.stampFlow;
  if (flow.skipped.includes(i)) return 'skipped';
  if (i < flow.stage) return 'done';
  if (i === flow.stage) return 'active';
  return 'locked';
}

// 「確認者へ提出」「確認2へ提出」のタイミングで、Outlook等の既定メールソフトの新規作成画面を
// 定型件名・本文つきで開く。mailto: の仕様上、添付ファイルの指定はできないため、
// エクスポート済みのファイルは手動で添付してもらう。
function openStampMailDraft(submitterName) {
  const subject = '受注報告登録メモ送信';
  const body = `掲題の件、回送よろしくお願いします。　${submitterName}`;
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const a = document.createElement('a');
  a.href = url;
  a.click();
}

function prevRealStage(record, stage) {
  const flow = record.stampFlow;
  for (let i = stage - 1; i >= 0; i--) {
    if (!flow.skipped.includes(i)) return i;
  }
  return -1;
}

async function advanceStampFlow(record, action) {
  const flow = record.stampFlow;
  const submitterName = (record.stampSlots[flow.stage]?.name || '').trim();

  if (action === 'submit' || action === 'toConfirm2' || action === 'finish') {
    const missingFields = validateRequiredFields(record);
    const invalidPatterns = validateFieldPatterns(record);
    const missingAttachments = missingRequiredAttachments(record);
    if (missingFields.length || invalidPatterns.length || missingAttachments.length) {
      const parts = [];
      if (missingFields.length) parts.push(`未入力の必須項目: ${missingFields.map((m) => m.label).join('、')}`);
      if (invalidPatterns.length) parts.push(`形式が正しくない項目: ${invalidPatterns.map((m) => m.label).join('、')}`);
      if (missingAttachments.length) parts.push(`未添付の必須書類: ${missingAttachments.join('、')}`);
      $('#saveStatus').textContent = parts.join(' / ');
      $('#saveStatus').classList.add('error');
      $('#saveStatus').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }

  const isSubmit = action === 'submit' || action === 'toConfirm2' || action === 'finish';

  if (isSubmit) {
    const exported = JSON.parse(JSON.stringify(record));
    const exportedFlow = exported.stampFlow;
    if (action === 'submit') {
      exportedFlow.stage = 1;
    } else if (action === 'toConfirm2') {
      exportedFlow.stage = 2;
    } else if (action === 'finish') {
      for (let i = flow.stage + 1; i < STAMP_SLOT_COUNT; i++) {
        if (!exportedFlow.skipped.includes(i)) exportedFlow.skipped.push(i);
      }
      exportedFlow.stage = STAMP_SLOT_COUNT;
    }
    saveRecord(record);
    const filename = await exportRecordToFile(exported, submitterName);
    if (filename && (action === 'submit' || action === 'toConfirm2')) {
      openStampMailDraft(submitterName);
      alert(`保存しました。\n\n📎 添付ファイルを忘れずに\n「${filename}」を、開いたOutlookの新規メールに添付してから送信してください。`);
      $('#saveStatus').textContent = `保存しました（${filename}）。Outlookの新規メールにこのファイルを添付して送付してください。このアプリを閉じます（` + new Date().toLocaleTimeString('ja-JP') + '）';
    } else {
      $('#saveStatus').textContent = '保存しました。Teams/メールで次の方へ送付してください。このアプリを閉じます（' + new Date().toLocaleTimeString('ja-JP') + '）';
    }
    $('#saveStatus').classList.remove('error');
    closeAppWindow();
    return;
  }

  if (action === 'reject') {
    const p = prevRealStage(record, flow.stage);
    if (p < 0) return;
    if (flow.stage < STAMP_SLOT_COUNT) record.stampSlots[flow.stage] = newStampSlot();
    record.stampSlots[p] = newStampSlot();
    flow.skipped = flow.skipped.filter((i) => i < p);
    flow.stage = p;
    saveRecord(record);
    refreshMainView();
    await exportRecordToFile(record, submitterName);
    $('#saveStatus').textContent = '差し戻しました。保存しました（' + new Date().toLocaleTimeString('ja-JP') + '）';
    $('#saveStatus').classList.remove('error');
  }
}

function stampNameOptions(sei, title) {
  return title ? { nameTop: sei, nameBottom: title } : { name: sei };
}

function buildStampDataUrl(slot) {
  const sei = (slot.name || '').trim();
  if (!sei) return null;
  const title = slot.title || '';
  const color = STAMP_TITLE_COLOR[title] || 'black';
  const radius = 120;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = radius * 2 + 8;
  const ctx = canvas.getContext('2d');
  DateStamp.draw(ctx, canvas.width / 2, canvas.height / 2, {
    ...stampNameOptions(sei, title),
    date: slot.date || todayIsoDate(),
    dateFormat: 'yy-slash',
    color,
    radius,
  });
  return canvas.toDataURL('image/png');
}

function renderStampBoxes(record) {
  const cells = $$('.stamp-boxes .stamp-cell');
  cells.forEach((cell, i) => {
    if (i >= STAMP_SLOT_COUNT) { cell.innerHTML = ''; return; } // 登録済検印セルは常に空欄
    const slot = record.stampSlots[STAMP_SLOT_COUNT - 1 - i] || newStampSlot();
    const dataUrl = buildStampDataUrl(slot);
    cell.innerHTML = dataUrl ? `<img class="stamp-img" src="${dataUrl}" alt="">` : '';
  });
}

const STAMP_STATE_BADGE = {
  done: '<span class="stamp-state-badge done">押印済み</span>',
  locked: '<span class="stamp-state-badge locked">🔒未解放</span>',
  skipped: '<span class="stamp-state-badge skipped">未使用</span>',
  active: '',
};

function rejectButtonHtml(record, stage) {
  const p = prevRealStage(record, stage);
  if (p < 0) return '';
  return `<button type="button" class="btn danger" id="stampRejectBtn">差し戻す（${STAMP_SLOT_LABELS[p]}へ）</button>`;
}

function renderStampFlowActions(record) {
  const area = $('#stampFlowActions');
  if (!area) return;
  const flow = record.stampFlow;
  const stage = flow.stage;
  const activeName = (record.stampSlots[stage]?.name || '').trim();

  if (stage >= STAMP_SLOT_COUNT) {
    area.innerHTML = `${rejectButtonHtml(record, STAMP_SLOT_COUNT)}<p class="stamp-flow-done">✓ すべての検印が完了しました</p>`;
    $('#stampRejectBtn')?.addEventListener('click', () => advanceStampFlow(record, 'reject'));
    return;
  }
  if (stage === 0) {
    area.innerHTML = `<button type="button" class="btn" id="stampSubmitBtn" ${activeName ? '' : 'disabled'}>確認者へ提出</button>`;
    $('#stampSubmitBtn').addEventListener('click', () => advanceStampFlow(record, 'submit'));
    return;
  }
  if (stage === 1) {
    area.innerHTML = `
      ${rejectButtonHtml(record, stage)}
      <button type="button" class="btn" id="stampToConfirm2Btn" ${activeName ? '' : 'disabled'}>確認2へ提出</button>
      <button type="button" class="btn primary" id="stampFinishBtn" ${activeName ? '' : 'disabled'}>確認を終えて完了</button>`;
    $('#stampToConfirm2Btn').addEventListener('click', () => advanceStampFlow(record, 'toConfirm2'));
    $('#stampFinishBtn').addEventListener('click', () => advanceStampFlow(record, 'finish'));
    $('#stampRejectBtn')?.addEventListener('click', () => advanceStampFlow(record, 'reject'));
    return;
  }
  if (stage === 2) {
    area.innerHTML = `
      ${rejectButtonHtml(record, stage)}
      <button type="button" class="btn primary" id="stampFinishBtn" ${activeName ? '' : 'disabled'}>確認を終えて完了</button>`;
    $('#stampFinishBtn').addEventListener('click', () => advanceStampFlow(record, 'finish'));
    $('#stampRejectBtn')?.addEventListener('click', () => advanceStampFlow(record, 'reject'));
  }
}

// 横並び表示順: 確認2 / 確認1 / 発行者（内部の record.stampSlots / STAMP_SLOT_LABELS の
// インデックス順（発行者=0, 確認1=1, 確認2=2）とは逆順で表示するため、明示的に並べ替える。
const STAMP_DISPLAY_ORDER = [2, 1, 0];

function renderStampInputs(record) {
  ensureStampSlots(record);
  ensureStampFlow(record);
  const grid = $('#stampInputGrid');
  grid.innerHTML = STAMP_DISPLAY_ORDER.map((i) => {
    const slot = record.stampSlots[i];
    const state = stampSlotState(record, i);
    const disabled = state !== 'active';
    return `
    <div class="stamp-input-row state-${state}">
      <span class="stamp-input-idx">${STAMP_SLOT_LABELS[i]}${STAMP_STATE_BADGE[state]}</span>
      <input type="text" class="stamp-name-input" data-idx="${i}" maxlength="10" placeholder="苗字" value="${escapeFieldHtml(slot.name || '')}" ${disabled ? 'disabled' : ''}>
      <select class="stamp-title-select" data-idx="${i}" ${disabled ? 'disabled' : ''}>
        ${STAMP_TITLES.map((t) => `<option value="${t}" ${slot.title === t ? 'selected' : ''}>${t || '（なし）'}</option>`).join('')}
      </select>
      <input type="date" class="stamp-date-input" data-idx="${i}" value="${slot.date || ''}" ${disabled ? 'disabled' : ''}>
    </div>`;
  }).join('');

  $$('.stamp-name-input', grid).forEach((input) => {
    input.addEventListener('input', () => {
      record.stampSlots[Number(input.dataset.idx)].name = input.value;
      renderStampBoxes(record);
      renderStampFlowActions(record); // keep the flow buttons' disabled state in sync with the active slot's name
      scheduleAutosave();
    });
  });
  $$('.stamp-title-select', grid).forEach((sel) => {
    sel.addEventListener('change', () => {
      record.stampSlots[Number(sel.dataset.idx)].title = sel.value;
      renderStampBoxes(record);
      scheduleAutosave();
    });
  });
  $$('.stamp-date-input', grid).forEach((input) => {
    input.addEventListener('input', () => {
      record.stampSlots[Number(input.dataset.idx)].date = input.value;
      renderStampBoxes(record);
      scheduleAutosave();
    });
  });

  renderStampFlowActions(record);
}
