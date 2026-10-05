import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { DataSource, Repository } from 'typeorm';
import { Container } from '../containers/entities/container.entity';
import { DcPrefix } from '../divisions/entities/dc-prefix.entity';
import { Division } from '../divisions/entities/division.entity';
import { HistoryEventType } from '../history/entities/history-event.entity';
import { HistoryService } from '../history/history.service';
import { Order } from '../orders/entities/order.entity';
import { nextPartColor } from '../parts/constants/part-colors';
import { Part } from '../parts/entities/part.entity';
import { ImportPreviewOrder, ImportResult, ImportRowError } from './dto/import-preview.dto';

const TEMPLATE_HEADERS = [
  'orderNumber',
  'division',
  'destination',
  'partName',
  'productCode',
  'divisionCode',
  'dcPrefix',
  'masterPo',
  'quantityPcs',
  'totalWeightKg',
  'cartonCount',
  'cartonSizeCm',
] as const;

interface RawRow {
  row: number;
  values: Record<string, string>;
}

// ExcelJS returns a formula cell's value as `{ formula, result }` rather than
// the plain result, and a rich-text cell as `{ richText: [...] }` rather than
// a plain string. Client sheets commonly compute columns like WEIGHT (KG) or
// CBM as formulas (e.g. "=I4*5.5"), so reading `cell.value` directly turns
// those into the literal string "[object Object]" once stringified -- this
// unwraps both shapes before falling back to a plain String() conversion.
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const obj = value as { result?: unknown; richText?: { text: string }[] };
    if ('result' in obj) return cellText(obj.result);
    if (Array.isArray(obj.richText))
      return obj.richText
        .map((t) => t.text)
        .join('')
        .trim();
  }
  return String(value).trim();
}

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(Division) private readonly divisions: Repository<Division>,
    @InjectRepository(DcPrefix) private readonly dcPrefixes: Repository<DcPrefix>,
    private readonly history: HistoryService,
    private readonly dataSource: DataSource,
  ) {}

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Import');
    sheet.addRow(TEMPLATE_HEADERS as unknown as string[]);
    sheet.addRow([
      'M91846',
      'PAV',
      'USA',
      'PART 1',
      'A009',
      'HG',
      '10',
      '134736',
      756,
      115.5,
      21,
      '45 x 38 x 16',
    ]);
    sheet.columns.forEach((col) => (col.width = 16));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async parseAndMaybeCommit(
    fileBuffer: Buffer,
    dryRun: boolean,
    originalFilename?: string,
    targetOrderId?: string,
    targetRackId?: string,
  ): Promise<ImportResult> {
    let effectiveTargetOrderId = targetOrderId;
    if (targetRackId) {
      const rack = await this.dataSource.getRepository(Container).findOne({ where: { id: targetRackId } });
      if (!rack) {
        throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ đích' });
      }
      if (!rack.orderId) {
        throw new BadRequestException({ code: 'RACK_WITHOUT_ORDER', message: 'Kệ đích chưa thuộc lô linh kiện nào' });
      }
      if (targetOrderId && targetOrderId !== rack.orderId) {
        throw new BadRequestException({ code: 'RACK_ORDER_MISMATCH', message: 'Kệ đích không thuộc lô linh kiện đã chọn' });
      }
      effectiveTargetOrderId = rack.orderId;
    }

    const { rows, containerHint } = await this.readRows(fileBuffer);
    const divisionCache = new Map<string, Division>();
    const dcPrefixCache = new Map<string, DcPrefix>();

    const ordersByNumber = new Map<string, ImportPreviewOrder>();
    const errors: ImportRowError[] = [];

    for (const raw of rows) {
      try {
        const parsed = await this.parseRow(raw, divisionCache, dcPrefixCache);
        let order = ordersByNumber.get(parsed.orderNumber);
        if (!order) {
          order = {
            orderNumber: parsed.orderNumber,
            division: parsed.division,
            destination: parsed.destination,
            parts: [],
          };
          ordersByNumber.set(parsed.orderNumber, order);
        }
        order.parts.push(parsed.part);
      } catch (err) {
        errors.push({ row: raw.row, message: (err as Error).message });
      }
    }

    const orders = Array.from(ordersByNumber.values());
    const partCount = orders.reduce((sum, o) => sum + o.parts.length, 0);

    if (dryRun || orders.length === 0) {
      return { dryRun: true, orders, orderCount: orders.length, partCount, errors, containerHint };
    }

    const { createdOrderIds, insertedPartCount, duplicatePartsSkipped } = await this.commit(
      orders,
      originalFilename,
      effectiveTargetOrderId,
      targetRackId,
    );
    await this.history.log(
      HistoryEventType.IMPORT,
      `Nhập file: ${orders.length} đơn hàng, ${insertedPartCount} PART` +
        (duplicatePartsSkipped > 0 ? ` (bỏ qua ${duplicatePartsSkipped} PART trùng)` : ''),
      {
        orderCount: orders.length,
        partCount: insertedPartCount,
        duplicatePartsSkipped,
        orderIds: createdOrderIds,
        targetRackId: targetRackId ?? null,
      },
      createdOrderIds.length === 1 ? createdOrderIds[0] : null,
    );

    return {
      dryRun: false,
      orders,
      orderCount: orders.length,
      partCount,
      errors,
      containerHint,
      createdOrderIds,
      insertedPartCount,
      duplicatePartsSkipped,
      targetRackId,
    };
  }

  // A PART row is a duplicate of one already on the order when every field
  // that isn't a generated id matches exactly — this is what makes
  // re-importing the same file into an order that already has these rows a
  // no-op instead of silently doubling every PART (see loading.service.ts
  // history — this bit the client for real: re-importing KH183 turned a
  // 26-PART order into 52).
  private partSignature(p: {
    divisionId: string;
    dcPrefixId: string;
    masterPo: string;
    partName: string;
    productCode: string | null;
    cartonCount: number;
    cartonLengthMm: number;
    cartonWidthMm: number;
    cartonHeightMm: number;
  }): string {
    return [
      p.divisionId,
      p.dcPrefixId,
      p.masterPo,
      p.partName,
      p.productCode ?? '',
      p.cartonCount,
      p.cartonLengthMm,
      p.cartonWidthMm,
      p.cartonHeightMm,
    ].join('|');
  }

  private async commit(
    orders: ImportPreviewOrder[],
    originalFilename?: string,
    targetOrderId?: string,
    targetRackId?: string,
  ): Promise<{
    createdOrderIds: string[];
    insertedPartCount: number;
    duplicatePartsSkipped: number;
  }> {
    const displayName = originalFilename ? originalFilename.replace(/\.[^./\\]+$/, '') : undefined;
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const partRepo = manager.getRepository(Part);
      const createdOrderIds: string[] = [];
      let colorCursor = await partRepo.count();
      let insertedPartCount = 0;
      let duplicatePartsSkipped = 0;

      // When importing into an order the user already has open, every row
      // goes there — never matched-and-merged against some OTHER existing
      // order just because the file's own order number happens to collide
      // with it (that's exactly what turned a 26-PART order into 52: a file
      // whose contents say "KH183" got imported while a DIFFERENT order was
      // the intended target, and the file's embedded KH183 silently won).
      let forcedRack: Container | null = null;
      if (targetRackId) {
        forcedRack = await manager.getRepository(Container).findOne({ where: { id: targetRackId } });
        if (!forcedRack) {
          throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ đích' });
        }
      }

      let forcedOrder: Order | null = null;
      if (targetOrderId) {
        forcedOrder = await orderRepo.findOne({ where: { id: targetOrderId } });
        if (!forcedOrder) {
          throw new NotFoundException({
            code: 'ORDER_NOT_FOUND',
            message: 'Không tìm thấy đơn hàng đích',
          });
        }
      }

      for (const o of orders) {
        let order = forcedOrder;
        if (!order) {
          order = await orderRepo.findOne({ where: { orderNumber: o.orderNumber } });
          if (!order) {
            order = await orderRepo.save(
              orderRepo.create({
                orderNumber: o.orderNumber,
                name: displayName || o.orderNumber,
                division: o.division,
                destination: o.destination,
              }),
            );
          }
        }
        createdOrderIds.push(order.id);

        const existingParts = await partRepo.find({ where: { orderId: order.id } });
        const seenSignatures = new Set(existingParts.map((p) => this.partSignature(p)));

        for (const p of o.parts) {
          const division = await manager
            .getRepository(Division)
            .findOneOrFail({ where: { code: p.divisionCode } });
          const dcPrefix = await manager
            .getRepository(DcPrefix)
            .findOneOrFail({ where: { divisionId: division.id, code: p.dcPrefix } });

          const signature = this.partSignature({
            divisionId: division.id,
            dcPrefixId: dcPrefix.id,
            masterPo: p.masterPo,
            partName: p.partName,
            productCode: p.productCode,
            cartonCount: p.cartonCount,
            cartonLengthMm: p.cartonLengthMm,
            cartonWidthMm: p.cartonWidthMm,
            cartonHeightMm: p.cartonHeightMm,
          });
          if (seenSignatures.has(signature)) {
            duplicatePartsSkipped++;
            continue;
          }
          seenSignatures.add(signature);

          const cbm =
            (p.cartonLengthMm * p.cartonWidthMm * p.cartonHeightMm * p.cartonCount) / 1_000_000_000;

          await partRepo.save(
            partRepo.create({
              orderId: order.id,
              partName: p.partName,
              productCode: p.productCode,
              divisionId: division.id,
              dcPrefixId: dcPrefix.id,
              masterPo: p.masterPo,
              quantityPcs: p.quantityPcs,
              totalWeightKg: p.totalWeightKg.toString(),
              cartonCount: p.cartonCount,
              cartonLengthMm: p.cartonLengthMm,
              cartonWidthMm: p.cartonWidthMm,
              cartonHeightMm: p.cartonHeightMm,
              cbm: cbm.toFixed(6),
              containerId: forcedRack?.id ?? null,
              preferredRackSlot: null,
              colorHex: nextPartColor(colorCursor++),
            }),
          );
          insertedPartCount++;
        }
      }
      return {
        createdOrderIds: [...new Set(createdOrderIds)],
        insertedPartCount,
        duplicatePartsSkipped,
      };
    });
  }

  private async readRows(fileBuffer: Buffer): Promise<{ rows: RawRow[]; containerHint?: string }> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_XLSX',
        message: 'File không đúng định dạng .xlsx',
      });
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException({ code: 'EMPTY_WORKBOOK', message: 'File không có sheet nào' });
    }

    const headerRow = sheet.getRow(1);
    const headerIndex = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const key = String(cell.value ?? '').trim();
      if (key) headerIndex.set(key, colNumber);
    });

    if (TEMPLATE_HEADERS.every((h) => headerIndex.has(h))) {
      return { rows: this.readRowsStrict(sheet, headerIndex) };
    }

    const businessResult = this.readRowsBusiness(sheet);
    if (businessResult) return businessResult;

    const missing = TEMPLATE_HEADERS.filter((h) => !headerIndex.has(h));
    throw new BadRequestException({
      code: 'MISSING_COLUMNS',
      message: `Thiếu cột bắt buộc: ${missing.join(', ')}`,
    });
  }

  private readRowsStrict(sheet: ExcelJS.Worksheet, headerIndex: Map<string, number>): RawRow[] {
    const rows: RawRow[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      if (row.cellCount === 0) continue;
      const values: Record<string, string> = {};
      let hasAny = false;
      for (const header of TEMPLATE_HEADERS) {
        const col = headerIndex.get(header)!;
        const cell = row.getCell(col);
        const value = cell.value;
        if (value !== null && value !== undefined && value !== '') hasAny = true;
        values[header] = cellText(value);
      }
      if (hasAny) rows.push({ row: r, values });
    }
    return rows;
  }

  /**
   * Recognizes the client's real-world "order info sheet" layout: a title row
   * (destination + container hint), a two-row merged column header containing
   * a "PART" cell, then an order-level metadata row (orderNumber, division),
   * then one part per row until a "TOTAL" sentinel row. The whole sheet is a
   * single order — column A on data rows is an internal reference the schema
   * doesn't model (productCode/divisionCode/etc. live in columns B-J).
   */
  private readRowsBusiness(
    sheet: ExcelJS.Worksheet,
  ): { rows: RawRow[]; containerHint?: string } | null {
    const norm = cellText;

    // ── Step 1: Locate the column-header row (the one containing a cell = 'PART') ──
    let columnHeaderRow = -1;
    for (let r = 1; r <= Math.min(6, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let found = false;
      row.eachCell((cell) => {
        if (norm(cell.value).toUpperCase() === 'PART') found = true;
      });
      if (found) {
        columnHeaderRow = r;
        break;
      }
    }
    if (columnHeaderRow === -1) return null;

    // ── Step 2: The meta row directly after the column header contains the
    //   order number (col A) and division (col B). The old check compared col C
    //   of the meta row against col C of the header row expecting them to match
    //   ("headerRepeated"), but the client's real file has actual data there —
    //   that check always returned false and caused the entire parser to bail.
    //   We replace it with a simpler heuristic: col A of the meta row looks
    //   like a non-empty, non-header order-number string (doesn't equal 'ORDER')
    // ─────────────────────────────────────────────────────────────────────────
    const metaRow = sheet.getRow(columnHeaderRow + 1);
    const orderNumber = norm(metaRow.getCell(1).value);
    const division = norm(metaRow.getCell(2).value);
    // Reject if col A is blank or repeats a header keyword
    if (!orderNumber || orderNumber.toUpperCase() === 'ORDER') return null;

    const destination = norm(sheet.getRow(1).getCell(1).value) || 'USA';

    // ── Step 3: Extract optional container hint from row-1 cells (e.g. col F:
    //   "One - 20' container" or "Two - 40DC containers").
    let containerHint: string | undefined;
    const row1 = sheet.getRow(1);
    row1.eachCell((cell) => {
      const val = norm(cell.value);
      // Heuristic: contains 'container' and a container-size keyword
      if (val && /container/i.test(val) && /20|40|45|HC|DC/i.test(val)) {
        containerHint = val;
      }
    });

    const padDcPrefix = (v: unknown) => norm(v).padStart(2, '0');
    const padMasterPo = (v: unknown) => norm(v).padStart(6, '0');

    // This sheet's own convention: "." groups thousands (e.g. "1.536" means
    // 1536), "," is the decimal point. Excel stores numeric cells typed that
    // way (US locale reading a "." as a decimal point) as a plain fraction
    // (e.g. 1.536), silently dropping the intended magnitude. Multiplying
    // back by 1000 recovers the true integer exactly — but only for cells
    // that were actually mis-parsed (non-integers); whole numbers were typed
    // correctly and must pass through unchanged.
    const parseQuantityPcs = (v: unknown): string => {
      if (typeof v === 'number') {
        return String(Number.isInteger(v) ? v : Math.round(v * 1000));
      }
      const str = norm(v).replace(/\./g, '').replace(',', '.');
      return str;
    };

    const rows: RawRow[] = [];
    for (let r = columnHeaderRow + 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const firstCell = norm(row.getCell(1).value);
      if (!firstCell) continue;
      if (firstCell.toUpperCase() === 'TOTAL') break;

      rows.push({
        row: r,
        values: {
          orderNumber,
          division,
          destination,
          productCode: norm(row.getCell(2).value),
          divisionCode: norm(row.getCell(3).value),
          dcPrefix: padDcPrefix(row.getCell(4).value),
          masterPo: padMasterPo(row.getCell(5).value),
          partName: norm(row.getCell(6).value),
          quantityPcs: parseQuantityPcs(row.getCell(7).value),
          totalWeightKg: norm(row.getCell(8).value),
          cartonCount: norm(row.getCell(9).value),
          cartonSizeCm: norm(row.getCell(10).value),
        },
      });
    }
    return { rows, containerHint };
  }

  private async parseRow(
    raw: RawRow,
    divisionCache: Map<string, Division>,
    dcPrefixCache: Map<string, DcPrefix>,
  ): Promise<{
    orderNumber: string;
    division: string;
    destination: string;
    part: ImportPreviewOrder['parts'][number];
  }> {
    const v = raw.values;
    const required = [
      'orderNumber',
      'partName',
      'divisionCode',
      'dcPrefix',
      'masterPo',
      'cartonSizeCm',
    ];
    for (const key of required) {
      if (!v[key]) throw new Error(`Thiếu giá trị cột "${key}"`);
    }

    const divisionKey = v.divisionCode.toUpperCase();
    let division = divisionCache.get(divisionKey);
    if (!division) {
      const found = await this.divisions.findOne({ where: { code: divisionKey } });
      if (!found) throw new Error(`Division "${v.divisionCode}" không tồn tại`);
      division = found;
      divisionCache.set(divisionKey, division);
    }

    const dcKey = `${division.id}:${v.dcPrefix}`;
    let dcPrefix = dcPrefixCache.get(dcKey);
    if (!dcPrefix) {
      const found = await this.dcPrefixes.findOne({
        where: { divisionId: division.id, code: v.dcPrefix },
      });
      if (!found) {
        throw new Error(`DC Prefix "${v.dcPrefix}" không thuộc Division "${v.divisionCode}"`);
      }
      dcPrefix = found;
      dcPrefixCache.set(dcKey, dcPrefix);
    }

    const sizeMatch =
      /^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(
        v.cartonSizeCm,
      );
    if (!sizeMatch) {
      throw new Error(
        `Không đọc được kích thước carton "${v.cartonSizeCm}" (định dạng: "L x W x H")`,
      );
    }
    const toMm = (cm: string) => Math.round(parseFloat(cm.replace(',', '.')) * 10);

    const quantityPcs = Math.round(parseFloat(v.quantityPcs.replace(',', '.')));
    const cartonCount = parseInt(v.cartonCount, 10);
    const totalWeightKg = parseFloat(v.totalWeightKg.replace(',', '.'));
    if (!Number.isFinite(quantityPcs) || quantityPcs <= 0)
      throw new Error('quantityPcs không hợp lệ');
    if (!Number.isFinite(cartonCount) || cartonCount <= 0)
      throw new Error('cartonCount không hợp lệ');
    if (!Number.isFinite(totalWeightKg) || totalWeightKg < 0)
      throw new Error('totalWeightKg không hợp lệ');
    if (quantityPcs < cartonCount) {
      throw new Error(
        `quantityPcs (${quantityPcs}) nhỏ hơn cartonCount (${cartonCount}) — có thể dấu phân cách hàng nghìn trong file bị đọc sai, vui lòng kiểm tra lại cột "QUANTITY (PCS)"`,
      );
    }

    return {
      orderNumber: v.orderNumber,
      division: v.division || v.divisionCode,
      destination: v.destination || 'USA',
      part: {
        partName: v.partName,
        productCode: v.productCode || null,
        divisionCode: division.code,
        dcPrefix: dcPrefix.code,
        masterPo: v.masterPo,
        quantityPcs,
        totalWeightKg,
        cartonCount,
        cartonLengthMm: toMm(sizeMatch[1]),
        cartonWidthMm: toMm(sizeMatch[2]),
        cartonHeightMm: toMm(sizeMatch[3]),
      },
    };
  }
}
