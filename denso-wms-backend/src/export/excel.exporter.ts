import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { fmtColumn, fmtLayer, fmtRow, formatPoLabel } from '../packing/domain/labels';
import { LoadPlan } from '../packing/entities/load-plan.entity';
import { CartonPlacement } from '../packing/entities/carton-placement.entity';
import { Order } from '../orders/entities/order.entity';
import { Container } from '../containers/entities/container.entity';
import { Part } from '../parts/entities/part.entity';
import { divisionFillArgb } from './division-colors';

export interface ContainerReport {
  container: Container;
  plan: LoadPlan;
  partsById: Map<string, Part>;
}

export interface ExportMeta {
  container: Container;
  order: Order | null;
  totalContainers: number;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' },
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  left: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
  right: { style: 'thin', color: { argb: 'FF94A3B8' } },
};

function formatVNDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Injectable()
export class ExcelExporter {
  /**
   * Single-container export: a header block (order, container, export
   * date, container count, ...), one colored grid per layer that
   * reproduces the app's on-screen Top View exactly (position + Division
   * color), then the client's required flat coordinate table.
   */
  async buildCoordinateSheet(
    plan: LoadPlan,
    partsById: Map<string, Part>,
    meta?: ExportMeta,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ke hoach xep hang');

    let row = 1;
    if (meta) {
      row = this.writeMetaHeader(sheet, meta.order, meta.container, meta.totalContainers, plan);
    }
    row = this.writeVisualLayerGrids(sheet, plan, partsById, row);
    row += 1;
    this.writeCoordinateTable(sheet, plan, partsById, row);

    sheet.getColumn(1).width = 30;
    sheet.columns.forEach((col) => {
      if (!col.width) col.width = 13;
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Order-scoped report: one sheet per container, each with the same
   * header block + visual layer grids as buildCoordinateSheet, plus the
   * per-PART allocation breakdown and the flat coordinate table — a single
   * ready-to-use workbook covering the whole order, no reformatting needed.
   */
  async buildOrderReport(order: Order, reports: ContainerReport[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const usedNames = new Set<string>();

    for (const { container, plan, partsById } of reports) {
      const sheet = workbook.addWorksheet(this.uniqueSheetName(container.name, usedNames));

      let row = this.writeMetaHeader(sheet, order, container, reports.length, plan);
      row = this.writeVisualLayerGrids(sheet, plan, partsById, row);
      row += 1;

      sheet.getRow(row).values = [
        'PART',
        'Division',
        'DC Prefix',
        'Master PO',
        'Số carton',
        'Wall bắt đầu',
        'Wall kết thúc',
      ];
      sheet.getRow(row).font = { bold: true };
      row += 1;
      for (const block of plan.blocks) {
        sheet.getRow(row).values = [
          block.partName,
          block.divisionCode,
          block.dcPrefixCode,
          block.masterPo,
          block.placedCartonCount,
          fmtRow(block.wallStart),
          fmtRow(block.wallEnd),
        ];
        row += 1;
      }
      row += 1;

      this.writeCoordinateTable(sheet, plan, partsById, row);
      sheet.getColumn(1).width = 30;
      sheet.columns.forEach((col) => {
        if (!col.width) col.width = 18;
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private writeMetaHeader(
    sheet: ExcelJS.Worksheet,
    order: Order | null,
    container: Container,
    totalContainers: number,
    plan: LoadPlan,
  ): number {
    const maxCbm = Number(container.maxCbmOverride ?? container.containerType.maxCbm);
    const maxPayloadKg = Number(
      container.maxPayloadKgOverride ?? container.containerType.maxPayloadKg,
    );

    let row = 1;
    const titleCell = sheet.getRow(row).getCell(1);
    titleCell.value = `SƠ ĐỒ PHÂN HÀNG KỆ KHO — ${container.name}`;
    titleCell.font = { bold: true, size: 14 };
    row += 1;

    const kv: [string, string][] = [
      ['Đơn hàng', order ? `${order.name} (${order.orderNumber})` : '—'],
      ['Điểm xuất → Điểm đến', order ? `${order.division} → ${order.destination}` : '—'],
      ['Ngày xuất', formatVNDateTime(new Date())],
      ['Kệ kho', container.name],
      ['Cấu hình sức chứa', container.containerType.label],
      ['Số lượng kệ (đơn hàng này)', String(totalContainers)],
      ['CBM sử dụng / tối đa', `${plan.cbmUsed} / ${maxCbm} m³`],
      ['Trọng lượng sử dụng / tối đa', `${plan.weightUsedKg} / ${maxPayloadKg} kg`],
      ['Số wall / layer', `${plan.wallCount} / ${plan.layerCount}`],
    ];
    for (const [label, value] of kv) {
      const r = sheet.getRow(row);
      r.getCell(1).value = label;
      r.getCell(1).font = { bold: true };
      r.getCell(2).value = value;
      row += 1;
    }
    return row + 1; // blank spacer row before the layer grids
  }

  /**
   * One visual grid per layer, matching the app's per-layer Top View
   * exactly: columns = walls (FRONT→DOOR, left to right, same order the
   * solver assigns wallIndex), rows = position across the container's
   * width, cell fill = the carton's Division color, cell text = its
   * "{DC Prefix}-{Master PO}" label — printing this sheet reproduces what's
   * on screen instead of only a flat coordinate list.
   */
  private writeVisualLayerGrids(
    sheet: ExcelJS.Worksheet,
    plan: LoadPlan,
    partsById: Map<string, Part>,
    startRow: number,
  ): number {
    let row = startRow;
    const byLayer = new Map<number, CartonPlacement[]>();
    for (const p of plan.placements) {
      if (!byLayer.has(p.layer)) byLayer.set(p.layer, []);
      byLayer.get(p.layer)!.push(p);
    }
    const layers = [...byLayer.keys()].sort((a, b) => a - b);

    for (const layer of layers) {
      const placements = byLayer.get(layer)!;
      const byWall = new Map<number, CartonPlacement[]>();
      for (const p of placements) {
        if (!byWall.has(p.wallIndex)) byWall.set(p.wallIndex, []);
        byWall.get(p.wallIndex)!.push(p);
      }
      const wallIndexes = [...byWall.keys()].sort((a, b) => a - b);
      let maxRows = 0;
      for (const wall of wallIndexes) {
        byWall.get(wall)!.sort((a, b) => a.column - b.column);
        maxRows = Math.max(maxRows, byWall.get(wall)!.length);
      }

      const titleRow = sheet.getRow(row);
      const titleCell = titleRow.getCell(1);
      titleCell.value = `${fmtLayer(layer)} — ${placements.length} thùng`;
      titleCell.font = { bold: true };
      titleCell.fill = HEADER_FILL;
      sheet.mergeCells(row, 1, row, wallIndexes.length + 1);
      row += 1;

      const headerRow = sheet.getRow(row);
      const cornerCell = headerRow.getCell(1);
      cornerCell.value = 'Vị trí';
      cornerCell.font = { bold: true };
      wallIndexes.forEach((wall, i) => {
        const cell = headerRow.getCell(i + 2);
        cell.value = fmtRow(wall);
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
      });
      row += 1;

      for (let r = 0; r < maxRows; r++) {
        const bodyRow = sheet.getRow(row);
        bodyRow.getCell(1).value = fmtColumn(r + 1);
        bodyRow.getCell(1).font = { italic: true };
        wallIndexes.forEach((wall, i) => {
          const placement = byWall.get(wall)![r];
          if (!placement) return;
          const part = partsById.get(placement.partId);
          const cell = bodyRow.getCell(i + 2);
          cell.value = formatPoLabel(part?.dcPrefix?.code, part?.masterPo);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: divisionFillArgb(part?.division?.code) },
          };
          cell.font = { size: 9, color: { argb: 'FF1E293B' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = THIN_BORDER;
        });
        row += 1;
      }
      row += 1; // spacer between layers
    }
    return row;
  }

  private writeCoordinateTable(
    sheet: ExcelJS.Worksheet,
    plan: LoadPlan,
    partsById: Map<string, Part>,
    startRow?: number,
  ): void {
    const headerRowIndex = startRow ?? 1;
    sheet.getRow(headerRowIndex).values = [
      'Layer',
      'Row',
      'Column',
      'Division',
      'DC Prefix',
      'Master PO',
      'Carton',
    ];
    sheet.getRow(headerRowIndex).font = { bold: true };

    const perPartSeq = new Map<string, number>();
    const sorted = [...plan.placements].sort(
      (a, b) => a.wallIndex - b.wallIndex || a.layer - b.layer || a.column - b.column,
    );

    let rowIndex = headerRowIndex + 1;
    for (const placement of sorted) {
      const part = partsById.get(placement.partId);
      const seq = (perPartSeq.get(placement.partId) ?? 0) + 1;
      perPartSeq.set(placement.partId, seq);

      sheet.getRow(rowIndex).values = [
        fmtLayer(placement.layer),
        fmtRow(placement.wallIndex),
        fmtColumn(placement.column),
        part?.division?.code ?? '',
        part?.dcPrefix?.code ?? '',
        part?.masterPo ?? '',
        seq,
      ];
      rowIndex += 1;
    }
  }

  private uniqueSheetName(name: string, used: Set<string>): string {
    // Excel sheet names cap at 31 chars and can't repeat within a workbook.
    const base = name.replace(/[[\]*?/\\:]/g, '-').slice(0, 28);
    let candidate = base || 'Ke-kho';
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base} (${suffix})`.slice(0, 31);
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  }
}
