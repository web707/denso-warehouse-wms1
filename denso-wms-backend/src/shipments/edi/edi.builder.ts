/**
 * Sinh thông báo giao hàng điện tử cho khách (Toyota/Honda):
 *  - ANSI X12 856  — Advance Ship Notice (ASN), phổ biến ở Bắc Mỹ
 *  - UN/EDIFACT DESADV D.96A — Despatch Advice, phổ biến ở châu Âu/châu Á
 *
 * Đây là bản "khung chuẩn" bám đúng cấu trúc segment của từng chuẩn. Mỗi khách hàng thường có
 * Implementation Guide riêng (mã đối tác, qualifier, segment bắt buộc), nên cần đối chiếu và
 * thử nghiệm với Toyota/Honda trước khi gửi thật. Mặc định đặt cờ TEST (ISA15 = T) để tránh gửi nhầm.
 */

export interface ShipmentEdiInput {
  shipmentId: number;
  shipmentNumber: string;
  customerNumber: string | null;
  customerName: string;
  requestedShipDate: Date | string | null;
  actualShipDate: Date | string | null;
  carrierCode: string | null;
  trackingNumber: string | null;
  grossWeight: number | null;
  weightUomCode: string;
  shippedQuantity: number;
  lotNumber: string | null;
  itemNumber: string;
  sourceOrderNumber: string | null;
}

export interface EdiOptions {
  /** Mã bên gửi (DENSO). Mặc định DENSOWMS. */
  senderId?: string;
  /** Mã bên nhận. Mặc định lấy CustomerNumber, nếu trống thì tên khách. */
  receiverId?: string;
  /** 'T' = thử nghiệm (mặc định), 'P' = chạy thật. Chỉ áp dụng cho X12. */
  usage?: 'T' | 'P';
  /** Thời điểm lập thông báo; mặc định bây giờ. Truyền vào để test ổn định. */
  now?: Date;
}

const two = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}`;
const yymmdd = (d: Date) => ymd(d).slice(2);
const hhmm = (d: Date) => `${two(d.getUTCHours())}${two(d.getUTCMinutes())}`;
const toDate = (v: Date | string | null): Date | null => (v ? new Date(v) : null);
const numStr = (n: number) => String(Number.parseFloat(n.toFixed(3)));
const idOf = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');

function resolveParties(s: ShipmentEdiInput, o: EdiOptions) {
  const sender = idOf(o.senderId || 'DENSOWMS') || 'DENSOWMS';
  const receiver = idOf(o.receiverId || s.customerNumber || s.customerName) || 'CUSTOMER';
  return { sender, receiver };
}

/** Số điều khiển 9 chữ số, lấy từ ShipmentId để mỗi lô có số riêng và truy ngược được. */
const controlNumber = (s: ShipmentEdiInput) => String(Math.max(1, Math.trunc(s.shipmentId))).padStart(9, '0').slice(-9);

/* ======================= ANSI X12 856 ======================= */

const x12Clean = (v: string | number | null | undefined) => String(v ?? '').replace(/[*~>^\r\n]/g, ' ').trim();

function x12Segment(...elements: Array<string | number | null | undefined>): string {
  const parts = elements.map((e) => x12Clean(e));
  while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  return `${parts.join('*')}~`;
}

export function buildX12Asn(s: ShipmentEdiInput, o: EdiOptions = {}): string {
  const now = o.now ?? new Date();
  const { sender, receiver } = resolveParties(s, o);
  const ctrl = controlNumber(s);
  const groupCtrl = String(Number(ctrl));
  const requested = toDate(s.requestedShipDate);
  const shipped = toDate(s.actualShipDate);

  // Từ ST đến SE (SE đếm cả ST và SE)
  const body: string[] = [
    x12Segment('ST', '856', '0001'),
    x12Segment('BSN', '00', s.shipmentNumber, ymd(now), hhmm(now), '0001'),
    x12Segment('HL', '1', '', 'S'),
  ];
  if (s.grossWeight !== null && s.grossWeight !== undefined) {
    body.push(x12Segment('TD1', '', '', '', '', '', 'G', numStr(s.grossWeight), s.weightUomCode || 'KG'));
  }
  if (s.carrierCode) body.push(x12Segment('TD5', '', '2', s.carrierCode));
  if (s.trackingNumber) body.push(x12Segment('REF', 'CN', s.trackingNumber));
  if (requested) body.push(x12Segment('DTM', '010', ymd(requested)));
  if (shipped) body.push(x12Segment('DTM', '011', ymd(shipped)));
  body.push(x12Segment('N1', 'ST', s.customerName, s.customerNumber ? '92' : '', s.customerNumber));
  body.push(x12Segment('HL', '2', '1', 'O'));
  if (s.sourceOrderNumber) body.push(x12Segment('PRF', s.sourceOrderNumber));
  body.push(x12Segment('HL', '3', '2', 'I'));
  body.push(x12Segment('LIN', '', 'BP', s.itemNumber, s.lotNumber ? 'LT' : '', s.lotNumber));
  body.push(x12Segment('SN1', '', numStr(s.shippedQuantity), 'EA'));
  body.push(x12Segment('CTT', '3'));
  body.push(x12Segment('SE', body.length + 1, '0001'));

  const isa = [
    'ISA', '00', ' '.repeat(10), '00', ' '.repeat(10),
    'ZZ', sender.slice(0, 15).padEnd(15, ' '),
    'ZZ', receiver.slice(0, 15).padEnd(15, ' '),
    yymmdd(now), hhmm(now), 'U', '00401', ctrl, '0', o.usage || 'T', '>',
  ].join('*') + '~';

  return [
    isa,
    x12Segment('GS', 'SH', sender, receiver, ymd(now), hhmm(now), groupCtrl, 'X', '004010'),
    ...body,
    x12Segment('GE', '1', groupCtrl),
    x12Segment('IEA', '1', ctrl),
  ].join('\n') + '\n';
}

/* ======================= UN/EDIFACT DESADV D.96A ======================= */

// Ký tự giải phóng của EDIFACT là '?': cần đặt trước + : ' ? khi nằm trong dữ liệu
const edifactClean = (v: string | number | null | undefined) =>
  String(v ?? '').replace(/[\r\n]/g, ' ').replace(/([+:'?])/g, '?$1').trim();

function edifactSegment(tag: string, ...elements: Array<string | string[] | null | undefined>): string {
  const parts = elements.map((e) => (Array.isArray(e) ? e.map(edifactClean).join(':') : edifactClean(e)));
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  return `${tag}${parts.length ? `+${parts.join('+')}` : ''}'`;
}

export function buildEdifactDesadv(s: ShipmentEdiInput, o: EdiOptions = {}): string {
  const now = o.now ?? new Date();
  const { sender, receiver } = resolveParties(s, o);
  const ctrl = controlNumber(s);
  const requested = toDate(s.requestedShipDate);
  const shipped = toDate(s.actualShipDate);

  // Từ UNH đến UNT (UNT đếm cả UNH và UNT)
  const body: string[] = [
    edifactSegment('UNH', '1', ['DESADV', 'D', '96A', 'UN']),
    edifactSegment('BGM', '351', s.shipmentNumber, '9'),
    edifactSegment('DTM', ['137', `${ymd(now)}${hhmm(now)}`, '203']),
  ];
  if (requested) body.push(edifactSegment('DTM', ['10', ymd(requested), '102']));
  if (shipped) body.push(edifactSegment('DTM', ['11', ymd(shipped), '102']));
  if (s.grossWeight !== null && s.grossWeight !== undefined) {
    body.push(edifactSegment('MEA', 'WT', 'G', [s.weightUomCode === 'KG' || !s.weightUomCode ? 'KGM' : s.weightUomCode, numStr(s.grossWeight)]));
  }
  if (s.sourceOrderNumber) body.push(edifactSegment('RFF', ['ON', s.sourceOrderNumber]));
  if (s.trackingNumber) body.push(edifactSegment('RFF', ['CN', s.trackingNumber]));
  body.push(
    edifactSegment('NAD', 'ST', s.customerNumber ? [s.customerNumber, '', '92'] : '', '', s.customerName),
  );
  if (s.carrierCode) body.push(edifactSegment('TDT', '20', '', '', '', [s.carrierCode, '172', '182']));
  body.push(edifactSegment('CPS', '1'));
  body.push(edifactSegment('LIN', '1', '', [s.itemNumber, 'BP']));
  body.push(edifactSegment('QTY', ['12', numStr(s.shippedQuantity), 'EA']));
  if (s.lotNumber) body.push(edifactSegment('GIN', 'BX', s.lotNumber));
  body.push(edifactSegment('UNT', String(body.length + 1), '1'));

  return [
    "UNA:+.? '",
    edifactSegment('UNB', ['UNOC', '3'], [sender, 'ZZ'], [receiver, 'ZZ'], [yymmdd(now), hhmm(now)], ctrl),
    ...body,
    edifactSegment('UNZ', '1', ctrl),
  ].join('\n') + '\n';
}

export type EdiStandard = 'x12' | 'edifact';

export function buildEdi(standard: EdiStandard, s: ShipmentEdiInput, o: EdiOptions = {}): string {
  return standard === 'edifact' ? buildEdifactDesadv(s, o) : buildX12Asn(s, o);
}
