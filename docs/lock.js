// 発行者が確認者へ提出した後（検印フローが発行者段階=0を過ぎた後）は、
// 確認者は「閲覧・添付ファイルの閲覧・出力・押印・特記事項の入力」のみ操作可能とし、
// それ以外の入力項目は編集不可にする。
// アプリ管理者は専用パスワードでこのロックを一時解除できる（レコードを開き直すと解除状態は元に戻る）。
// 注: これはデモ版専用のパスワードであり、本番版のパスワードとは異なる。
const ADMIN_UNLOCK_PASSWORD = 'demo-unlock-2026';

let adminUnlocked = false;

function resetAdminUnlock() {
  adminUnlocked = false;
}

function isRecordLocked(record) {
  return !!(record && record.stampFlow && record.stampFlow.stage > 0) && !adminUnlocked;
}

function applyLockState(record) {
  const locked = isRecordLocked(record);
  if (locked) {
    $$('#formRoot [data-field]').forEach((el) => {
      if (el.dataset.field === 'tokkijikou') return;
      el.disabled = true;
    });
    $$('#formRoot [data-field-search]').forEach((el) => { el.disabled = true; });
    $$('#formRoot [data-table-field]').forEach((el) => { el.disabled = true; });
  }
  $('#formRoot')?.classList.toggle('form-locked', locked);
  renderLockBanner(record);
}

function renderLockBanner(record) {
  const area = $('#lockBanner');
  if (!area) return;
  const submitted = !!(record.stampFlow && record.stampFlow.stage > 0);

  if (adminUnlocked) {
    area.hidden = false;
    area.innerHTML = `
      <span class="lock-banner-text">🔓 管理者パスワードでロックを解除しています（すべての項目を編集できます）</span>
      <button type="button" class="btn" id="relockBtn">ロックに戻す</button>`;
    $('#relockBtn').addEventListener('click', () => {
      adminUnlocked = false;
      refreshMainView();
    });
    return;
  }

  if (!submitted) {
    area.hidden = true;
    area.innerHTML = '';
    return;
  }

  area.hidden = false;
  area.innerHTML = `
    <span class="lock-banner-text">🔒 発行者から提出済みのため、特記事項・添付書類の閲覧・出力・押印以外は編集できません</span>
    <button type="button" class="btn" id="adminUnlockBtn">管理者パスワードでロック解除</button>`;
  $('#adminUnlockBtn').addEventListener('click', () => {
    const pw = prompt('管理者パスワードを入力してください');
    if (pw === null) return;
    if (pw !== ADMIN_UNLOCK_PASSWORD) {
      alert('パスワードが違います');
      return;
    }
    adminUnlocked = true;
    refreshMainView();
  });
}
