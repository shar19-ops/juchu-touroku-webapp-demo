function printFieldLabel(id, rawValue) {
  if (rawValue == null || rawValue === '') return '';
  const field = FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.id === id);
  const option = field?.options?.find((o) => o.value === String(rawValue));
  return option ? option.label : String(rawValue);
}

// 入力画面と同じ「（コード）名称」表記・単位接尾辞・円表示ルールを踏まえて、
// フィールド定義から印刷用の表示テキストを1つ組み立てる。
function printFieldDisplay(field, record) {
  const raw = record.fields[field.id];
  if (field.type === 'table') return '';
  if (field.type === 'yen') return raw ? `${yen(raw)}円` : '';
  if (field.type === 'select') {
    const label = printFieldLabel(field.id, raw);
    return label ? `${label}${field.suffix || ''}` : '';
  }
  if (field.type === 'customer-search' || field.type === 'staff-search' || field.type === 'prefecture-search') {
    if (!raw) return '';
    return raw.code ? `（${raw.code}）${raw.name || ''}` : (raw.name || '');
  }
  if (raw == null || raw === '') return '';
  return `${raw}${field.suffix || ''}`;
}

// 入力画面で右詰め表示にしている項目（style.css参照）と同じ条件を印刷側にも適用する。
const PRINT_RIGHT_ALIGN_IDS = new Set([
  'araritsuKettei', 'araritsuSuitei', 'shouhizeiRitsu',
  'dekidakaShimeBi', 'seikyuShimeBi', 'shiharaiBi',
  'maetokinWariai', 'chukanBaraiKaisuu', 'shunkougoWariai',
  'genkinWariai', 'tegataWariai', 'saitoNissuu',
]);

function printFieldCardHtml(field, record) {
  const value = printFieldDisplay(field, record);
  const widthClass = field.width ? ` print-field-${field.width}` : '';
  const reqClass = field.required ? ' required' : '';
  const alignClass = (field.type === 'yen' || PRINT_RIGHT_ALIGN_IDS.has(field.id)) ? ' align-right' : '';
  const noLabel = field.no ? `${field.no}. ` : '';
  return `
    <div class="print-field${widthClass}${reqClass}">
      <div class="print-field-label">${escapeFieldHtml(noLabel + field.label)}</div>
      <div class="print-field-value${alignClass}">${escapeFieldHtml(value)}</div>
    </div>`;
}

// 大項目（基本情報・金額・関係者など）の見出しは印刷では不要のため出さず、
// 入力画面のrows構成（無ければ全項目1行）だけを引用してカードを並べる。
function printGroupHtml(group, record) {
  const rows = group.rows || [group.fields.map((f) => f.id)];
  return rows.map((row) => `<div class="print-row">${
    row.map((id) => {
      const field = group.fields.find((f) => f.id === id);
      return field ? printFieldCardHtml(field, record) : '';
    }).join('')
  }</div>`).join('');
}

function buildPrintSheet(record) {
  const f = record.fields;
  const sheet = $('#printSheet');

  const attachmentChecklist = ATTACHMENT_DEFS
    .filter((def) => def.isRequired(f))
    .map((def) => `${record.attachments[def.id] ? '✓' : '✗'}${def.label}`)
    .join('　');

  const bodyGroups = FIELD_GROUPS.filter((g) => g.groupLabel !== 'ヘッダー' && g.groupLabel !== '38. 小工事実行予算');
  const formHtml = bodyGroups.map((g) => printGroupHtml(g, record)).join('');

  sheet.innerHTML = `
    <div class="print-title">受 注 報 告 登 録 メ モ</div>
    <div class="print-row">
      <div class="print-field">
        <div class="print-field-label">注文区分</div>
        <div class="print-field-value">${escapeFieldHtml(printFieldLabel('juchuKubun', f.juchuKubun))}</div>
      </div>
      <div class="print-field">
        <div class="print-field-label">施工事業所コード</div>
        <div class="print-field-value">${escapeFieldHtml(printFieldLabel('sekouJigyosho', f.sekouJigyosho))}</div>
      </div>
      <div class="print-field">
        <div class="print-field-label">工事番号</div>
        <div class="print-field-value">${escapeFieldHtml(f.koujiBangou || '')}</div>
      </div>
      <div class="print-field">
        <div class="print-field-label">見積番号</div>
        <div class="print-field-value">${escapeFieldHtml(f.mitsumoriBangou || '')}</div>
      </div>
    </div>
    <div class="print-form">${formHtml}</div>
    <table class="print-komouji-table">
      <caption>38. 小工事実行予算</caption>
      <tr><td></td><td>材料費(F50)</td><td>外注費(Z50)</td><td>工料(K50)</td><td>経費(O00)</td><td>計</td></tr>
      <tr><td>積算金額</td><td>${yen(f.komoujiYosan?.zumi?.zairyouhi || 0)}円</td><td>${yen(f.komoujiYosan?.zumi?.gaichuuhi || 0)}円</td><td>${yen(f.komoujiYosan?.zumi?.kouryou || 0)}円</td><td>${yen(f.komoujiYosan?.zumi?.keihi || 0)}円</td><td>${yen(calcKomoujiKei(f.komoujiYosan?.zumi))}円</td></tr>
      <tr><td>実行金額</td><td>${yen(f.komoujiYosan?.jikko?.zairyouhi || 0)}円</td><td>${yen(f.komoujiYosan?.jikko?.gaichuuhi || 0)}円</td><td>${yen(f.komoujiYosan?.jikko?.kouryou || 0)}円</td><td>${yen(f.komoujiYosan?.jikko?.keihi || 0)}円</td><td>${yen(calcKomoujiKei(f.komoujiYosan?.jikko))}円</td></tr>
    </table>
    <p class="print-attachment-checklist">添付書類: ${attachmentChecklist || 'なし'}</p>
    <div class="print-stamp-section">
      <div class="stamp-boxes">
        <table class="stamp-merged-table">
          <tr>
            <td class="stamp-name-label">確認</td>
            <td class="stamp-name-label">確認</td>
            <td class="stamp-name-label">発行者</td>
          </tr>
          <tr>
            <td class="stamp-cell"></td>
            <td class="stamp-cell"></td>
            <td class="stamp-cell"></td>
          </tr>
        </table>
        <table class="stamp-standalone-table">
          <tr><td class="stamp-name-label">登録済検印</td></tr>
          <tr><td class="stamp-cell" title="登録済検印（紙ベース）"></td></tr>
        </table>
      </div>
    </div>
    <img class="print-footer-logo" src="images/footer-logo.jpg" alt="">
  `;
  renderStampBoxes(record);
}
