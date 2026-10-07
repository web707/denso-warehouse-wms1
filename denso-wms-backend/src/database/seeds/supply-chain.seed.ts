import { DataSource } from 'typeorm';
import { Inspection } from '../../inspections/entities/inspection.entity';
import { Shipment } from '../../shipments/entities/shipment.entity';
import { WorkOrder } from '../../work-orders/entities/work-order.entity';

const DAY = 86_400_000;
const daysFromNow = (n: number): Date => new Date(Date.now() + n * DAY);

/**
 * Dữ liệu MẪU cho Khâu 1, 4, 5 (giả lập, theo cấu trúc trường trong tài liệu Oracle).
 * Dùng chung LotNumber với seed đơn mẫu KH183 (LOT-2026-001 / LOT-2026-002) để thử truy vết.
 */
export async function seedSupplyChain(dataSource: DataSource): Promise<void> {
  const woRepo = dataSource.getRepository(WorkOrder);
  const inspRepo = dataSource.getRepository(Inspection);
  const shipRepo = dataSource.getRepository(Shipment);

  if (await woRepo.findOne({ where: { workOrderNumber: 'WO-2026-0001' } })) {
    // eslint-disable-next-line no-console
    console.log('  supply-chain sample data already exists — skipping');
    return;
  }

  await woRepo.save([
    woRepo.create({
      workOrderNumber: 'WO-2026-0001', workOrderType: 'STANDARD', workOrderStatus: 'COMPLETED', itemNumber: 'A009',
      lotNumber: 'LOT-2026-001', plannedStartQuantity: 5000, completedQuantity: 4950, scrappedQuantity: 50,
      plannedStartDate: daysFromNow(-30), plannedCompletionDate: daysFromNow(-20), actualStartDate: daysFromNow(-30),
      actualCompletionDate: daysFromNow(-19), dueDate: daysFromNow(-18), workCenterCode: 'WC-CNC-01', workCenterName: 'Xưởng CNC 1',
      resourceCode: 'CNC-07', workDefinitionCode: 'WD-A009', operationSequenceNumber: 30, operationStatus: 'COMPLETED',
      customerNumber: 'C-TOY', customerName: 'Toyota', demandSourceHeaderNumber: 'SO-88101', firmPlannedFlag: true,
    }),
    woRepo.create({
      workOrderNumber: 'WO-2026-0002', workOrderType: 'STANDARD', workOrderStatus: 'RELEASED', itemNumber: 'A007',
      lotNumber: 'LOT-2026-002', plannedStartQuantity: 12000, completedQuantity: 7200, scrappedQuantity: 120, inProcessQuantity: 800,
      plannedStartDate: daysFromNow(-12), plannedCompletionDate: daysFromNow(-2), actualStartDate: daysFromNow(-12),
      dueDate: daysFromNow(-1), workCenterCode: 'WC-ASM-02', workCenterName: 'Xưởng lắp ráp 2', resourceCode: 'ASM-03',
      workDefinitionCode: 'WD-A007', operationSequenceNumber: 20, operationStatus: 'IN_PROGRESS',
      customerNumber: 'C-HON', customerName: 'Honda', demandSourceHeaderNumber: 'SO-88142', expeditedFlag: true,
    }),
    woRepo.create({
      workOrderNumber: 'WO-2026-0003', workOrderType: 'REWORK', workOrderStatus: 'ON_HOLD', itemNumber: 'A007',
      lotNumber: 'LOT-2026-003', plannedStartQuantity: 600, completedQuantity: 0, plannedStartDate: daysFromNow(-3),
      plannedCompletionDate: daysFromNow(4), dueDate: daysFromNow(6), workCenterCode: 'WC-QA-01', workCenterName: 'Khu làm lại',
      customerNumber: 'C-HON', customerName: 'Honda', demandSourceHeaderNumber: 'SO-88142',
    }),
    woRepo.create({
      workOrderNumber: 'WO-2026-0004', workOrderType: 'STANDARD', workOrderStatus: 'UNRELEASED', itemNumber: 'A009',
      lotNumber: 'LOT-2026-004', plannedStartQuantity: 8000, plannedStartDate: daysFromNow(5), plannedCompletionDate: daysFromNow(15),
      dueDate: daysFromNow(18), workCenterCode: 'WC-CNC-01', workCenterName: 'Xưởng CNC 1', customerNumber: 'C-TOY', customerName: 'Toyota',
      demandSourceHeaderNumber: 'SO-88190', firmPlannedFlag: true,
    }),
  ]);

  await inspRepo.save([
    inspRepo.create({
      inspectionId: 'INS-SEED-0001', lotNumber: 'LOT-2026-001', workOrderNumber: 'WO-2026-0001', inspectionType: 'FINAL',
      inspectionDate: daysFromNow(-19), sampleSize: 200, passQuantity: 200, failQuantity: 0, judgment: 'OK',
      measuredValue1: 10.02, upperTolerance: 10.1, lowerTolerance: 9.9, inspectorId: 'QC-014',
    }),
    inspRepo.create({
      inspectionId: 'INS-SEED-0002', lotNumber: 'LOT-2026-002', workOrderNumber: 'WO-2026-0002', inspectionType: 'IN-PROCESS',
      inspectionDate: daysFromNow(-6), sampleSize: 150, passQuantity: 147, failQuantity: 3, judgment: 'NG',
      defectCode: 'D-101', measuredValue1: 25.31, upperTolerance: 25.2, lowerTolerance: 24.8, inspectorId: 'QC-021',
    }),
    inspRepo.create({
      inspectionId: 'INS-SEED-0003', lotNumber: 'LOT-2026-003', workOrderNumber: 'WO-2026-0003', inspectionType: 'INCOMING',
      inspectionDate: daysFromNow(-2), sampleSize: 80, passQuantity: 80, failQuantity: 0, judgment: 'HOLD',
      inspectorId: 'QC-014',
    }),
  ]);

  await shipRepo.save([
    shipRepo.create({
      shipmentNumber: 'SHP-2026-0001', customerNumber: 'C-TOY', customerName: 'Toyota', requestedShipDate: daysFromNow(-17),
      actualShipDate: daysFromNow(-15), shipmentStatus: 'DELIVERED', carrierCode: 'DHL', trackingNumber: 'DHL884201',
      grossWeight: 1250, weightUomCode: 'KG', shippedQuantity: 4950, lotNumber: 'LOT-2026-001', itemNumber: 'A009',
      sourceOrderNumber: 'PO-TOY-5521',
    }),
    shipRepo.create({
      shipmentNumber: 'SHP-2026-0002', customerNumber: 'C-HON', customerName: 'Honda', requestedShipDate: daysFromNow(-3),
      shipmentStatus: 'RELEASED', carrierCode: 'FEDEX', grossWeight: 980, weightUomCode: 'KG', shippedQuantity: 6000,
      lotNumber: 'LOT-2026-002', itemNumber: 'A007', sourceOrderNumber: 'PO-HON-3307',
    }),
    shipRepo.create({
      shipmentNumber: 'SHP-2026-0003', customerNumber: 'C-TOY', customerName: 'Toyota', requestedShipDate: daysFromNow(9),
      shipmentStatus: 'RELEASED', carrierCode: 'DHL', grossWeight: 400, weightUomCode: 'KG', shippedQuantity: 2000,
      lotNumber: 'LOT-2026-001', itemNumber: 'A009', sourceOrderNumber: 'PO-TOY-5560',
    }),
  ]);

  // eslint-disable-next-line no-console
  console.log('  supply-chain sample data seeded (4 work orders, 3 inspections, 3 shipments)');
}
