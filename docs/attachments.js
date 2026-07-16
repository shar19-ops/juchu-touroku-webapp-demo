const ATTACHMENT_DEFS = [
  { id: 'mitsumorisho', label: '見積書', isRequired: () => true },
  { id: 'chumonsho', label: '注文書', isRequired: (f) => f.chumonshoruiShikibetsu === '1' },
  { id: 'shodakusho', label: '承諾書', isRequired: (f) => f.chumonshoruiShikibetsu === '2' },
  { id: 'jikkoYosansho', label: '実行予算書', isRequired: (f) => Number(f.keiyakuKingaku) > 5000000 },
  { id: 'koujiKeihiKeisansho', label: '工事経費計算書', isRequired: (f) => Number(f.keiyakuKingaku) > 5000000 },
];

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: reader.result,
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function missingRequiredAttachments(record) {
  return ATTACHMENT_DEFS
    .filter((def) => def.isRequired(record.fields) && !record.attachments[def.id])
    .map((def) => def.label);
}

// data: URLはブラウザによってはwindow.open()での直接遷移がブロックされ、
// タブは開くが中身が表示されない（手動リロードで表示される）ことがある。
// blob: URLに変換してから開くとこの問題を回避できる。
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = (header.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function openAttachmentPreview(attachment) {
  const blobUrl = URL.createObjectURL(dataUrlToBlob(attachment.dataUrl));
  const win = window.open(blobUrl, '_blank');
  if (win) {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return;
  }
  URL.revokeObjectURL(blobUrl);
  // ポップアップがブロックされた場合はダウンロードにフォールバック
  const a = document.createElement('a');
  a.href = attachment.dataUrl;
  a.download = attachment.filename;
  a.click();
}

function renderAttachments(record) {
  const root = $('#attachmentsRoot');
  const locked = isRecordLocked(record);
  root.innerHTML = `<h2>添付書類</h2>` + ATTACHMENT_DEFS.map((def) => {
    const required = def.isRequired(record.fields);
    const existing = record.attachments[def.id];
    return `
      <div class="attachment-row" data-attachment-id="${def.id}">
        <span class="attachment-label${required ? ' required' : ''}">${def.label}${required ? '（必須）' : ''}</span>
        <span class="attachment-file-info">${existing ? `${escapeFieldHtml(existing.filename)}（${Math.round(existing.size / 1024)}KB）` : (required ? '<span class="attachment-missing">未添付</span>' : '未添付')}</span>
        <input type="file" data-attachment-input="${def.id}" hidden>
        ${existing ? `<button type="button" class="btn" data-attachment-view="${def.id}">表示</button>` : ''}
        ${locked ? '' : `<button type="button" class="btn" data-attachment-select="${def.id}">${existing ? '差し替え' : '選択'}</button>`}
        ${existing && !locked ? `<button type="button" class="btn danger" data-attachment-remove="${def.id}">削除</button>` : ''}
      </div>`;
  }).join('');

  ATTACHMENT_DEFS.forEach((def) => {
    const fileInput = $(`[data-attachment-input="${def.id}"]`, root);
    const selectBtn = $(`[data-attachment-select="${def.id}"]`, root);
    if (selectBtn) selectBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        record.attachments[def.id] = await fileToAttachment(file);
      } catch (err) {
        alert('ファイルを読み込めませんでした: ' + err.message);
        return;
      }
      renderAttachments(record);
      scheduleAutosave();
    });
    const removeBtn = $(`[data-attachment-remove="${def.id}"]`, root);
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        delete record.attachments[def.id];
        renderAttachments(record);
        scheduleAutosave();
      });
    }
    const viewBtn = $(`[data-attachment-view="${def.id}"]`, root);
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        const existing = record.attachments[def.id];
        if (existing) openAttachmentPreview(existing);
      });
    }
  });
}
