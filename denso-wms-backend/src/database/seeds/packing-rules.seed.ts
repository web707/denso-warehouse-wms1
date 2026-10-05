import { DataSource } from 'typeorm';
import { PackingRule } from '../../packing-rules/entities/packing-rule.entity';

// The 13 rules verbatim from the current frontend's seedData.js (so the
// PackingRules page reads unchanged), plus 5 rules the "Quy ước đóng hàng"
// sheet mandates that the frontend never modelled. All are is_system = true:
// deletable is blocked, but toggling `active` or rewording `text` is fine.
export const PACKING_RULE_SEED = [
  { text: 'Hướng chất hàng: Front → Door', category: 'Hướng chất', icon: 'ArrowRight' },
  { text: 'Được phép xoay carton 90°', category: 'Xoay carton', icon: 'RotateCw' },
  { text: 'Không trộn PART trong cùng 1 Block', category: 'Phân PART', icon: 'Ban' },
  { text: 'Mỗi PART là một Block riêng', category: 'Phân Block', icon: 'Box' },
  { text: 'Mỗi Block có 01 màu riêng biệt', category: 'Màu sắc', icon: 'Palette' },
  { text: 'Chất hàng từ trong ra ngoài (Front trước)', category: 'Thứ tự chất', icon: 'Layers' },
  { text: 'Phân bổ trọng lượng đều trên sàn kệ', category: 'Phân bổ', icon: 'Weight' },
  {
    text: 'Không xếp quá cao — dưới mức cửa kệ',
    category: 'Chiều cao',
    icon: 'PackageCheck',
  },
  { text: 'Sử dụng lót/giằng hàng khi cần thiết', category: 'Giằng hàng', icon: 'ShieldCheck' },
  { text: 'Kiểm tra kích thước thùng trước khi đóng', category: 'Kiểm tra', icon: 'Ruler' },
  { text: 'Ghi chú PART/Block trên sơ đồ đóng hàng', category: 'Ghi chú', icon: 'ClipboardList' },
  {
    text: 'Tổng CBM không vượt quá giới hạn kệ',
    category: 'Giới hạn',
    icon: 'AlertTriangle',
  },
  {
    text: 'Tổng trọng lượng không vượt quá giới hạn kệ',
    category: 'Giới hạn',
    icon: 'AlertTriangle',
  },
  // From "Quy ước đóng hàng" — not present in the old frontend seed:
  {
    text: 'Xếp theo thứ tự: Division (HomeGoods → Marshalls → TJ Maxx) → DC Prefix → Master PO tăng dần',
    category: 'Thứ tự xếp',
    icon: 'ListOrdered',
  },
  {
    text: 'Block loading: không xen kẽ nhiều DC Prefix / PO khác nhau trong cùng khu vực',
    category: 'Phân Block',
    icon: 'LayoutGrid',
  },
  {
    text: 'Một carton wall chỉ được chứa tối đa 2 DC Prefix, khi prefix sau là phần tiếp nối của prefix trước',
    category: 'Carton wall',
    icon: 'Columns',
  },
  {
    text: 'Chỉ được xếp chồng carton lên cùng PART, không chồng lên PART khác',
    category: 'Xếp chồng',
    icon: 'Layers3',
  },
  {
    text: 'Chỉ khi PART đã chạm trần kệ mà vẫn còn hàng mới được phép mở wall mới',
    category: 'Xếp chồng',
    icon: 'ArrowUpToLine',
  },
];

export async function seedPackingRules(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(PackingRule);
  const existingCount = await repo.count();
  if (existingCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`  packing_rules already seeded (${existingCount} rows) — skipping`);
    return;
  }
  const rows = PACKING_RULE_SEED.map((r, index) =>
    repo.create({ ...r, active: true, isSystem: true, sortOrder: index }),
  );
  await repo.save(rows);
  // eslint-disable-next-line no-console
  console.log(`  packing_rules seeded (${rows.length} rules)`);
}
