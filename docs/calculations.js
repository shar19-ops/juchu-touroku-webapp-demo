function yen(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '';
  return Number(n).toLocaleString('ja-JP');
}

function formatRate(rate) {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '-';
  const truncated = Math.floor(rate * 10) / 10;
  return truncated.toFixed(1) + '%';
}

function calcConsumptionTax(baseKingaku, taxRatePercent) {
  const base = Number(baseKingaku);
  const rate = Number(taxRatePercent);
  if (!Number.isFinite(base) || !Number.isFinite(rate)) return 0;
  return base * (rate / 100);
}

// 生の比率(%)を返す。小数点第2位切捨てはformatRate()側で行う。
function calcAraritsu(keiyakuKingaku, jikkoKingaku) {
  const keiyaku = Number(keiyakuKingaku);
  const jikko = Number(jikkoKingaku);
  if (!keiyaku) return null;
  if (!Number.isFinite(jikko)) return null;
  return ((keiyaku - jikko) / keiyaku) * 100;
}

function calcKomoujiKei(row) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  if (!row) return 0;
  return n(row.zairyouhi) + n(row.gaichuuhi) + n(row.kouryou) + n(row.keihi);
}

function isAllHiraganaOrKana(s) {
  return /^[぀-ゟ゠-ヿー]*$/.test(s || '');
}

function hiraganaToFullWidthKatakana(s) {
  return String(s ?? '').replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
