function fieldWrapperHtml(field, valueHtml, requiredNow) {
  const requiredClass = requiredNow ? ' required' : '';
  const widthClass = field.width ? ` field-${field.width}` : '';
  const noLabel = field.no ? `${field.no}. ` : '';
  return `
    <div class="field${requiredClass}${widthClass}" data-field-id="${field.id}">
      <label>${noLabel}${field.label}</label>
      ${valueHtml}
      ${field.hint ? `<span class="hint">${escapeFieldHtml(field.hint)}</span>` : ''}
      ${field.pattern ? `<span class="field-error" data-field-error="${field.id}" hidden></span>` : ''}
    </div>`;
}

function escapeFieldHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// コードを名称より先に表示する共通フォーマット: 「（コード）名称」
function codeNameDisplay(code, name) {
  return code ? `（${code}）${name || ''}` : (name || '');
}

function renderSimpleInputHtml(field, value) {
  const v = escapeFieldHtml(value ?? '');
  const roAttr = field.readOnly ? 'disabled' : '';
  let html;
  switch (field.type) {
    case 'text':
      html = `<input type="text" data-field="${field.id}" value="${v}" ${field.maxLength ? `maxlength="${field.maxLength}"` : ''} ${roAttr}>`;
      break;
    case 'textarea':
      html = `<textarea data-field="${field.id}" ${field.maxLength ? `maxlength="${field.maxLength}"` : ''} ${roAttr}>${v}</textarea>`;
      break;
    case 'number':
      html = `<input type="number" data-field="${field.id}" value="${v}" ${roAttr}>`;
      break;
    case 'yen':
      html = `<input type="text" inputmode="numeric" data-field="${field.id}" data-yen="1" value="${value ? yen(value) : ''}" ${roAttr}>`;
      break;
    case 'date':
      html = `<input type="date" data-field="${field.id}" value="${v}" ${roAttr}>`;
      break;
    case 'select':
      html = `<select data-field="${field.id}" ${roAttr}>
        <option value=""></option>
        ${field.options.map((o) => `<option value="${o.value}" ${value === o.value ? 'selected' : ''}>${escapeFieldHtml(o.label)}</option>`).join('')}
      </select>`;
      break;
    default:
      html = `<input type="text" data-field="${field.id}" value="${v}" ${roAttr}>`;
  }
  if (field.suffix) {
    return `<div class="input-with-suffix">${html}<span class="input-suffix">${escapeFieldHtml(field.suffix)}</span></div>`;
  }
  return html;
}

function renderSearchFieldHtml(field, record) {
  const stored = record.fields[field.id] || { code: '', name: '' };
  const display = codeNameDisplay(stored.code, stored.name);
  return `
    <div class="search-field" data-search-field="${field.id}" data-search-type="${field.type}">
      <input type="text" class="search-input" data-field-search="${field.id}" value="${escapeFieldHtml(display)}" autocomplete="off" placeholder="コードまたは名称で検索">
      <div class="search-results" hidden></div>
    </div>`;
}

function renderTableFieldHtml(field, record) {
  const data = record.fields[field.id] || {};
  const rowsHtml = field.rows.map((row) => {
    const rowData = data[row.key] || {};
    const cells = field.columns.map((col) => `<td><div class="input-with-suffix"><input type="text" inputmode="numeric" data-table-field="${field.id}" data-row="${row.key}" data-col="${col.key}" data-yen="1" value="${rowData[col.key] ? yen(rowData[col.key]) : ''}"><span class="input-suffix">円</span></div></td>`).join('');
    return `<tr><th>${row.label}</th>${cells}<td class="komouji-kei"><span data-kei-row="${row.key}">0</span>円</td></tr>`;
  }).join('');
  return `
    <table class="komouji-table">
      <thead><tr><th></th>${field.columns.map((c) => `<th>${c.label}</th>`).join('')}<th>計</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="komouji-error" data-komouji-error="zumi" hidden></div>
    <div class="komouji-error" data-komouji-error="jikko" hidden></div>`;
}

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

function findFieldDef(id) {
  return ALL_FIELDS.find((f) => f.id === id);
}

function fieldIsRequiredNow(field, record) {
  if (typeof field.requiredIf === 'function') return field.requiredIf(record.fields);
  return !!field.required;
}

function demoSearchNoticeHtml(field) {
  if (!DEMO_MODE) return '';
  if (field.type !== 'customer-search' && field.type !== 'staff-search') return '';
  return `<span class="hint demo-hint">⚠ デモ版のため、サンプルデータのみ検索できます（実在のデータではありません）</span>`;
}

function renderFieldHtml(field, record) {
  const requiredNow = fieldIsRequiredNow(field, record);
  if (field.type === 'customer-search' || field.type === 'staff-search' || field.type === 'prefecture-search') {
    return fieldWrapperHtml(field, renderSearchFieldHtml(field, record) + demoSearchNoticeHtml(field), requiredNow);
  }
  if (field.type === 'table') {
    return fieldWrapperHtml(field, renderTableFieldHtml(field, record), requiredNow);
  }
  return fieldWrapperHtml(field, renderSimpleInputHtml(field, record.fields[field.id]), requiredNow);
}

function renderForm(record) {
  const root = $('#formRoot');
  root.innerHTML = FIELD_GROUPS.map((group) => {
    const fieldById = new Map(group.fields.map((f) => [f.id, f]));
    // group.rows（あれば）で明示的な行区切りに従う。無ければ従来通り1行にflex-wrapで並べる。
    const rowsOfFields = group.rows
      ? group.rows.map((ids) => ids.map((id) => fieldById.get(id)))
      : [group.fields];
    const rowsHtml = rowsOfFields.map((rowFields) => `
      <div class="field-row${group.layout === 'grid2' ? ' grid-2col' : ''}">
        ${rowFields.map((field) => renderFieldHtml(field, record)).join('')}
      </div>`).join('');
    return `
    <section class="panel">
      ${group.hideLabel ? '' : `<h2>${escapeFieldHtml(group.groupLabel)}</h2>`}
      ${rowsHtml}
    </section>`;
  }).join('');

  bindSimpleInputs(record);
  bindSearchFields(record);
  bindTableFields(record);
  bindFuriganaAutoFill(record);
  runAutoCalculations(record);
}

function bindSimpleInputs(record) {
  $$('#formRoot [data-field]').forEach((el) => {
    const id = el.dataset.field;
    const isYen = el.dataset.yen === '1';
    const field = findFieldDef(id);
    const handler = () => {
      let value = el.value;
      if (isYen) {
        const digits = value.replace(/[^\d-]/g, '');
        value = digits === '' ? '' : Number(digits);
      }
      record.fields[id] = value;
      runAutoCalculations(record);
      scheduleAutosave();
    };
    el.addEventListener('change', handler);
    if (isYen) {
      el.addEventListener('blur', () => {
        if (record.fields[id] !== '' && record.fields[id] != null) el.value = yen(record.fields[id]);
      });
      el.addEventListener('focus', () => el.select());
    }
    if (field?.pattern) {
      el.addEventListener('blur', () => validateFieldPatterns(record));
    }
  });
}

function bindSearchFields(record) {
  $$('#formRoot [data-search-field]').forEach((wrapper) => {
    const id = wrapper.dataset.searchField;
    const type = wrapper.dataset.searchType;
    const input = $(`[data-field-search="${id}"]`, wrapper);
    const results = $('.search-results', wrapper);
    const searchFn = type === 'customer-search' ? CustomerMaster.search
      : type === 'staff-search' ? StaffMaster.search
      : PrefectureMaster.search;

    input.addEventListener('input', () => {
      const query = input.value;
      const matches = searchFn(query, 20);
      const canAddLocal = type === 'customer-search' && query.trim();
      if (!matches.length && !canAddLocal) { results.hidden = true; return; }
      results.innerHTML = matches.map((m, i) => {
        const label = type === 'prefecture-search' ? codeNameDisplay(m.todoufukenCode + m.shikuchousonCode, m.display) : codeNameDisplay(m.code, m.name);
        const badge = m.source === 'local' ? '<span class="badge-local">個人追加</span>' : '';
        return `<div data-idx="${i}">${escapeFieldHtml(label)}${badge}</div>`;
      }).join('') + (canAddLocal ? `<div class="search-add-local" data-add-local>＋ 個人マスタに追加: "${escapeFieldHtml(query.trim())}"</div>` : '');
      results.hidden = false;
      $$('div[data-idx]', results).forEach((row, i) => {
        row.addEventListener('mousedown', () => {
          const m = matches[i];
          if (type === 'prefecture-search') {
            const code = m.todoufukenCode + m.shikuchousonCode;
            record.fields[id] = { code, name: m.display, todoufukenCode: m.todoufukenCode, shikuchousonCode: m.shikuchousonCode };
            input.value = codeNameDisplay(code, m.display);
            applyPrefixLink(id, record);
          } else {
            record.fields[id] = { code: m.code, name: m.name };
            input.value = codeNameDisplay(m.code, m.name);
          }
          results.hidden = true;
          scheduleAutosave();
        });
      });
      const addRow = $('[data-add-local]', results);
      if (addRow) {
        addRow.addEventListener('mousedown', () => {
          const name = query.trim();
          const rawCode = prompt('得意先コードを入力してください（空欄可）', '');
          if (rawCode === null) return; // ユーザーがキャンセルした場合は何もしない
          const code = rawCode.trim();
          CustomerMaster.addLocal(code, name);
          record.fields[id] = { code, name };
          input.value = codeNameDisplay(code, name);
          results.hidden = true;
          scheduleAutosave();
        });
      }
    });
    input.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 150));
  });
}

// 検索欄（例: 06.施工地区）の選択値を、prefixFrom で紐付けたテキスト欄（例: 07.工事場所）の先頭に反映する。
// 反映済みの接頭辞（data-auto-prefix）だけを新しい値に差し替え、その後ろにユーザーが自由入力した部分は保持する。
function applyPrefixLink(sourceFieldId, record) {
  const targetField = FIELD_GROUPS.flatMap((g) => g.fields).find((f) => f.prefixFrom === sourceFieldId);
  if (!targetField) return;
  const targetInput = $(`#formRoot [data-field="${targetField.id}"]`);
  if (!targetInput) return;

  const newPrefix = record.fields[sourceFieldId]?.name || '';
  const oldPrefix = targetInput.dataset.autoPrefix || '';
  const current = targetInput.value || '';
  const suffix = current === oldPrefix ? '' : (oldPrefix && current.startsWith(oldPrefix)) ? current.slice(oldPrefix.length) : current;

  const newValue = newPrefix + suffix;
  targetInput.value = newValue;
  targetInput.dataset.autoPrefix = newPrefix;
  targetInput.setSelectionRange(newValue.length, newValue.length); // 続けて入力できるようカーソルを末尾へ
  record.fields[targetField.id] = newValue;
  scheduleAutosave();
}

function bindTableFields(record) {
  $$('#formRoot [data-table-field]').forEach((el) => {
    const id = el.dataset.tableField;
    const rowKey = el.dataset.row;
    const col = el.dataset.col;
    const handler = () => {
      const digits = el.value.replace(/[^\d-]/g, '');
      const value = digits === '' ? 0 : Number(digits);
      record.fields[id] = record.fields[id] || {};
      record.fields[id][rowKey] = record.fields[id][rowKey] || {};
      record.fields[id][rowKey][col] = value;
      runAutoCalculations(record);
      scheduleAutosave();
    };
    el.addEventListener('change', handler);
    el.addEventListener('blur', () => { el.value = yen(Number(el.value.replace(/[^\d-]/g, '')) || 0); });
    el.addEventListener('focus', () => el.select());
  });
}

// 03.物件略称(漢字)へのIME入力中、変換確定前のかな（compositionupdate）を捕捉し、
// 全角カタカナに変換して04.物件略称(ｶﾀｶﾅ)へ自動反映する。
// ユーザーが04を手動編集した後は、その内容を上書きしない。
function bindFuriganaAutoFill(record) {
  const kanjiInput = $('#formRoot [data-field="bukkenRyakushoKanji"]');
  const kanaInput = $('#formRoot [data-field="bukkenRyakushoKana"]');
  if (!kanjiInput || !kanaInput) return;

  let composingKana = '';
  let autoFilledValue = kanaInput.value || '';

  kanjiInput.addEventListener('compositionstart', () => {
    composingKana = '';
  });
  kanjiInput.addEventListener('compositionupdate', (e) => {
    if (isAllHiraganaOrKana(e.data)) composingKana = e.data;
  });
  kanjiInput.addEventListener('compositionend', () => {
    if (!composingKana) return;
    if (kanaInput.value !== autoFilledValue) return; // ユーザーが手動編集済みなら追記しない
    autoFilledValue += hiraganaToFullWidthKatakana(composingKana);
    kanaInput.value = autoFilledValue;
    record.fields.bukkenRyakushoKana = autoFilledValue;
    scheduleAutosave();
  });
  kanjiInput.addEventListener('input', () => {
    if (kanjiInput.value === '') autoFilledValue = '';
  });
}

function updateKoujiBangouAvailability(record) {
  const isNewOrder = record.fields.juchuKubun === '1';
  const input = $('#formRoot [data-field="koujiBangou"]');
  const wrapper = $('#formRoot [data-field-id="koujiBangou"]');
  if (input) {
    input.disabled = isNewOrder;
    if (isNewOrder && record.fields.koujiBangou) {
      record.fields.koujiBangou = '';
      input.value = '';
    }
  }
  if (wrapper) {
    wrapper.classList.toggle('required', !isNewOrder);
    if (isNewOrder) wrapper.classList.remove('invalid');
  }
}

// 36.予算変更: 注文区分が1(新規)/5(取消)のときは入力不可、それ以外は入力必須。
function updateYosanHenkouAvailability(record) {
  const kubun = record.fields.juchuKubun;
  const noInput = kubun === '1' || kubun === '5';
  const input = $('#formRoot [data-field="yosanHenkou"]');
  const wrapper = $('#formRoot [data-field-id="yosanHenkou"]');
  if (input) {
    input.disabled = noInput;
    if (noInput && record.fields.yosanHenkou) {
      record.fields.yosanHenkou = '';
      input.value = '';
    }
  }
  if (wrapper) {
    wrapper.classList.toggle('required', !noInput);
    if (noInput) wrapper.classList.remove('invalid');
  }
}

// 38.小工事実行予算: 10.契約金額が5,000,000円を超える場合は入力を受け付けない
// （実行予算書/工事経費計算書の添付が必須になる規模のため、この簡易表は対象外とする）。
// 10.契約金額の編集で500万円超に変わった場合は、38に入力済みの内容を破棄する。
function updateKomoujiYosanAvailability(record) {
  const locked = Number(record.fields.keiyakuKingaku) > 5000000;
  if (locked && record.fields.komoujiYosan) {
    delete record.fields.komoujiYosan;
    $$('#formRoot [data-table-field="komoujiYosan"]').forEach((input) => { input.value = ''; });
    $$('#formRoot [data-kei-row]').forEach((el) => { el.textContent = yen(0); });
    $$('#formRoot [data-komouji-error]').forEach((el) => { el.hidden = true; });
  }
  $$('#formRoot [data-table-field="komoujiYosan"]').forEach((input) => {
    input.disabled = locked;
  });
  const wrapper = $('#formRoot [data-field-id="komoujiYosan"]');
  if (wrapper) {
    wrapper.classList.toggle('required', !locked);
    if (locked) wrapper.classList.remove('invalid');
  }
}

// 34.支払条件区分に応じて、通常時専用欄(出来高締/請求締/支払日)と
// 特殊時専用欄(前渡金/中間払/竣工後)のどちらかを無効化する。
function updateShiharaiJoukenAvailability(record) {
  const isTokushu = record.fields.shiharaiKubun === '1';

  const applyGroup = (ids, disabled, toggleRequired) => {
    ids.forEach((id) => {
      const input = $(`#formRoot [data-field="${id}"]`);
      const wrapper = $(`#formRoot [data-field-id="${id}"]`);
      if (input) {
        input.disabled = disabled;
        if (disabled && record.fields[id] !== '' && record.fields[id] != null) {
          record.fields[id] = '';
          input.value = '';
        }
      }
      if (wrapper) {
        if (toggleRequired) wrapper.classList.toggle('required', !disabled);
        if (disabled) wrapper.classList.remove('invalid');
      }
    });
  };

  applyGroup(['dekidakaShimeBi', 'seikyuShimeBi', 'shiharaiBi'], isTokushu, true);
  applyGroup(['maetokinWariai', 'chukanBaraiKaisuu', 'shunkougoWariai'], !isTokushu, false);
}

function runAutoCalculations(record) {
  const f = record.fields;

  updateKoujiBangouAvailability(record);
  updateYosanHenkouAvailability(record);
  updateShiharaiJoukenAvailability(record);

  // 14. 消費税相当額 = 契約金額 × 消費税率(既定10%)
  if (f.shouhizeiRitsu === '' || f.shouhizeiRitsu == null) f.shouhizeiRitsu = 10;
  if (f.keiyakuKingaku !== '' && f.keiyakuKingaku != null) {
    f.shouhizeiSoutougaku = Math.round(calcConsumptionTax(f.keiyakuKingaku, f.shouhizeiRitsu));
  } else {
    delete f.shouhizeiSoutougaku;
  }
  const taxEl = $('#formRoot [data-field="shouhizeiSoutougaku"]');
  if (taxEl) taxEl.value = f.shouhizeiSoutougaku ? yen(f.shouhizeiSoutougaku) : '';

  // 13. 粗利率 = (契約金額－推定実行金額)÷契約金額（小数点第2位切捨て）
  f.araritsuSuitei = formatRate(calcAraritsu(f.keiyakuKingaku, f.suiteiJikkoKingaku));
  const araritsuSuiteiEl = $('#formRoot [data-field="araritsuSuitei"]');
  if (araritsuSuiteiEl) araritsuSuiteiEl.value = f.araritsuSuitei;

  // 34. 手形（%）= 100 - 現金（%）
  if (f.genkinWariai !== '' && f.genkinWariai != null) {
    f.tegataWariai = 100 - Number(f.genkinWariai);
    const tegataEl = $('#formRoot [data-field="tegataWariai"]');
    if (tegataEl) tegataEl.value = f.tegataWariai;
  }

  // 38. 小工事実行予算の計 + 12/13との一致チェック
  updateKomoujiYosanAvailability(record);
  if (f.komoujiYosan) {
    const keiMap = {};
    ['zumi', 'jikko'].forEach((rowKey) => {
      const kei = calcKomoujiKei(f.komoujiYosan[rowKey]);
      keiMap[rowKey] = kei;
      const keiEl = $(`#formRoot [data-kei-row="${rowKey}"]`);
      if (keiEl) keiEl.textContent = yen(kei);
    });

    const checkKomoujiMismatch = (rowKey, kei, targetFieldId, targetLabel) => {
      const errEl = $(`#formRoot [data-komouji-error="${rowKey}"]`);
      if (!errEl) return;
      const targetRaw = f[targetFieldId];
      const hasTarget = targetRaw !== '' && targetRaw != null;
      const rowLabel = rowKey === 'zumi' ? '積算金額合計' : '実行金額合計';
      if (kei > 0 && hasTarget && kei !== Number(targetRaw)) {
        errEl.textContent = `${rowLabel}（${yen(kei)}円）が${targetLabel}（${yen(Number(targetRaw))}円）と一致しません`;
        errEl.hidden = false;
      } else {
        errEl.hidden = true;
      }
    };
    checkKomoujiMismatch('zumi', keiMap.zumi, 'saishuMitsumoriKingaku', '12.最終見積金額');
    checkKomoujiMismatch('jikko', keiMap.jikko, 'suiteiJikkoKingaku', '13.推定実行金額');
  }
}

const REQUIRED_FIELD_IDS = ALL_FIELDS.filter((f) => f.required).map((f) => f.id);

function isFieldEmpty(record, id) {
  const v = record.fields[id];
  if (v == null || v === '') return true;
  if (typeof v === 'object') {
    if ('code' in v) return !v.code;
    if ('zumi' in v || 'jikko' in v) return false; // table field: presence of the object counts as filled
  }
  return false;
}

function validateRequiredFields(record) {
  const missing = [];
  $$('#formRoot .field').forEach((el) => el.classList.remove('invalid'));
  for (const field of ALL_FIELDS) {
    if (!fieldIsRequiredNow(field, record)) continue;
    if (isFieldEmpty(record, field.id)) {
      missing.push({ id: field.id, label: field.label });
      const el = $(`#formRoot [data-field-id="${field.id}"]`);
      if (el) el.classList.add('invalid');
    }
  }
  return missing;
}

function validateFieldPatterns(record) {
  const invalid = [];
  $$('#formRoot [data-field-error]').forEach((el) => { el.hidden = true; el.textContent = ''; });
  for (const field of ALL_FIELDS) {
    if (!field.pattern) continue;
    const wrapper = $(`#formRoot [data-field-id="${field.id}"]`);
    const value = record.fields[field.id];
    if (value == null || value === '') {
      if (wrapper) wrapper.classList.remove('invalid');
      continue;
    }
    const re = new RegExp(field.pattern);
    if (!re.test(String(value))) {
      const message = field.patternMessage || '形式が正しくありません';
      invalid.push({ id: field.id, label: field.label, message });
      const errEl = $(`#formRoot [data-field-error="${field.id}"]`);
      if (errEl) { errEl.hidden = false; errEl.textContent = message; }
      if (wrapper) wrapper.classList.add('invalid');
    } else if (wrapper) {
      wrapper.classList.remove('invalid');
    }
  }
  return invalid;
}
