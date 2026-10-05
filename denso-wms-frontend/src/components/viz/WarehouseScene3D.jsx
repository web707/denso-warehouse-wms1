import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, Text } from '@react-three/drei';
import { api } from '@/api';
import { Flame, Layers, TrendingUp, AlertTriangle } from 'lucide-react';

const RACK_W = 2.35;
const RACK_H = 2.1;
const RACK_D = 0.75;
const COL_GAP = 3.05;
const ROW_GAP = 2.55;
const COLS = 5;
const ROWS = 4;

const STATUS_COLORS = {
  empty: '#94a3b8',
  active: '#22c55e',
  near: '#f59e0b',
  full: '#6366f1',
  overload: '#ef4444',
};

function getHeatmapColor(score) {
  if (score > 80) {
    return { bg: '#ef4444', text: '#b91c1c', border: '#f87171', label: 'Cực nóng (Ùn tắc / Lấy nhiều)' };
  }
  if (score >= 60) {
    return { bg: '#f97316', text: '#c2410c', border: '#fb923c', label: 'Tần suất cao' };
  }
  if (score >= 30) {
    return { bg: '#eab308', text: '#a16207', border: '#facc15', label: 'Tần suất trung bình' };
  }
  return { bg: '#3b82f6', text: '#1d4ed8', border: '#60a5fa', label: 'Lưu kho tĩnh / Ít thao tác' };
}

function Beam({ position, size, color }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.12} />
    </mesh>
  );
}

function MiniRackFrame({ status, selected, highlighted, heatmapScore, showHeatmap }) {
  const post = 0.055;
  const beam = 0.055;
  const heat = showHeatmap && heatmapScore !== undefined ? getHeatmapColor(heatmapScore) : null;
  const accent = selected || highlighted ? '#312e81' : heat ? heat.border : '#1d4ed8';
  const shelf = heat ? heat.bg : STATUS_COLORS[status] || STATUS_COLORS.empty;

  const elements = [];
  for (let bay = 0; bay <= 5; bay += 1) {
    const x = -RACK_W / 2 + (RACK_W / 5) * bay;
    elements.push(
      <Beam key={`pf-${bay}`} position={[x, RACK_H / 2, -RACK_D / 2]} size={[post, RACK_H, post]} color={accent} />,
      <Beam key={`pb-${bay}`} position={[x, RACK_H / 2, RACK_D / 2]} size={[post, RACK_H, post]} color={accent} />,
    );
  }
  for (let level = 0; level <= 4; level += 1) {
    const y = (RACK_H / 4) * level;
    elements.push(
      <Beam key={`bf-${level}`} position={[0, y, -RACK_D / 2]} size={[RACK_W, beam, beam]} color={shelf} />,
      <Beam key={`bb-${level}`} position={[0, y, RACK_D / 2]} size={[RACK_W, beam, beam]} color={shelf} />,
    );
  }
  return <group>{elements}</group>;
}

function WarehouseRack({ rack, position, selected, highlighted, onSelect, heatmapInfo, showHeatmap }) {
  const [hovered, setHovered] = useState(false);
  const score = heatmapInfo?.score ?? 0;
  const heat = showHeatmap ? getHeatmapColor(score) : null;
  const statusColor = heat ? heat.bg : STATUS_COLORS[rack.status] || STATUS_COLORS.empty;

  const auraOpacity = selected
    ? 0.22
    : highlighted
    ? 0.18
    : hovered
    ? 0.16
    : heat
    ? score > 80
      ? 0.32
      : score >= 60
      ? 0.2
      : score >= 30
      ? 0.09
      : 0.04
    : 0.025;

  return (
    <group position={position}>
      <mesh
        position={[0, RACK_H / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(rack.id);
        }}
      >
        <boxGeometry args={[RACK_W * 1.04, RACK_H * 1.02, RACK_D * 1.18]} />
        <meshStandardMaterial
          color={statusColor}
          transparent
          opacity={auraOpacity}
          depthWrite={false}
        />
      </mesh>

      <MiniRackFrame
        status={rack.status}
        selected={selected}
        highlighted={highlighted}
        heatmapScore={showHeatmap ? score : undefined}
        showHeatmap={showHeatmap}
      />

      <Text
        position={[0, RACK_H + 0.18, 0]}
        fontSize={0.21}
        color={
          showHeatmap
            ? score > 80
              ? '#b91c1c'
              : score >= 60
              ? '#c2410c'
              : '#1e293b'
            : highlighted
            ? '#312e81'
            : '#0f172a'
        }
        anchorX="center"
        anchorY="middle"
      >
        {rack.name} {showHeatmap ? `[${score}đ]` : ''}
      </Text>

      {hovered && (
        <Html position={[0, RACK_H + 0.55, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="rounded-lg border bg-white/95 backdrop-blur-sm p-3 shadow-xl text-[11px] whitespace-nowrap min-w-[210px] border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b pb-1.5 mb-1.5">
              <span className="font-bold text-slate-900 text-xs">
                {rack.zoneCode} / {rack.name}
              </span>
              {showHeatmap ? (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: heat.bg }}
                >
                  {score}/100đ · Class {heatmapInfo?.velocityClass || 'C'}
                </span>
              ) : (
                <span className="text-slate-500">{rack.warehouseCode}</span>
              )}
            </div>

            {showHeatmap ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Tổng giao dịch:</span>
                  <span className="font-bold text-slate-900">{heatmapInfo?.operations?.total || 0} lượt</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Nhập: {heatmapInfo?.operations?.inbound || 0}</span>
                  <span>Xuất: {heatmapInfo?.operations?.outbound || 0}</span>
                  <span>Chuyển: {heatmapInfo?.operations?.transfer || 0}</span>
                </div>
                <div className="text-[10px] pt-1 font-semibold" style={{ color: heat.text }}>
                  {score > 80
                    ? '⚠️ Khu vực mật độ cao - Nguy cơ ùn tắc'
                    : score >= 60
                    ? '⚡ Khu vực luân chuyển hàng nhanh'
                    : '💤 Khu vực hàng lưu kho tĩnh'}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-slate-700 font-medium">
                  {rack.usedSlots}/20 ô · {rack.partCount} PART
                </div>
                <div className="text-slate-500">
                  {rack.totalWeight.toLocaleString('vi-VN')} kg · {rack.totalCbm.toFixed(2)} m³
                </div>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function WarehouseShell({ warehouseCode, zoneCode }) {
  const floorW = COLS * COL_GAP + 2.4;
  const floorD = ROWS * ROW_GAP + 2.6;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[floorW, floorD]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.92} />
      </mesh>
      <gridHelper args={[Math.max(floorW, floorD), 30, '#94a3b8', '#cbd5e1']} position={[0, 0, 0]} />
      <mesh position={[0, 2.4, -floorD / 2]} receiveShadow>
        <boxGeometry args={[floorW, 4.8, 0.08]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[-floorW / 2, 2.4, 0]} receiveShadow>
        <boxGeometry args={[0.08, 4.8, floorD]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <Text
        position={[0, 4.1, -floorD / 2 + 0.09]}
        fontSize={0.42}
        color="#334155"
        anchorX="center"
      >
        {warehouseCode} · {zoneCode} · 20 RACKS
      </Text>
    </group>
  );
}

export default function WarehouseScene3D({
  racks,
  selectedRackId,
  highlightedRackIds,
  onSelectRack,
  warehouseCode = 'DENSO-WH',
  zoneCode = 'ZONE-A',
  className,
  initialHeatmap = true,
  heatmapData: externalHeatmapData,
}) {
  const [showHeatmap, setShowHeatmap] = useState(initialHeatmap);
  const [internalHeatmapData, setInternalHeatmapData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch heatmap data from API if not provided via props
  useEffect(() => {
    if (externalHeatmapData) {
      setInternalHeatmapData(externalHeatmapData);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.inventory
      .heatmap({ warehouseCode, zoneCode, days: 90 })
      .then((data) => {
        if (!cancelled) {
          setInternalHeatmapData(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load heatmap data in WarehouseScene3D:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [warehouseCode, zoneCode, externalHeatmapData]);

  const heatmapData = externalHeatmapData || internalHeatmapData;

  const layout = useMemo(
    () =>
      racks.slice(0, 20).map((rack, index) => {
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        const x = (col - (COLS - 1) / 2) * COL_GAP;
        const z = (row - (ROWS - 1) / 2) * ROW_GAP;
        return { ...rack, position: [x, 0, z] };
      }),
    [racks],
  );

  return (
    <div className={`relative ${className || ''}`} style={{ minHeight: 620, height: 620, width: '100%' }}>
      {/* HUD Control Bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-lg border border-slate-200 shadow-md">
        <button
          type="button"
          onClick={() => setShowHeatmap(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            !showHeatmap
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Tải trọng kho
        </button>
        <button
          type="button"
          onClick={() => setShowHeatmap(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            showHeatmap
              ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Heatmap 3D {loading ? '(Đang tải...)' : '(Lưu lượng)'}
        </button>
      </div>

      {/* Heatmap Metrics Banner */}
      {showHeatmap && heatmapData?.summary && (
        <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center gap-3 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-md text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <span>Kệ nóng nhất:</span>
            <strong className="text-red-600">
              {heatmapData.summary.hottestRack?.name} ({heatmapData.summary.hottestRack?.score}đ)
            </strong>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span>Pareto:</span>
            <strong className="text-indigo-600">
              {heatmapData.summary.paretoRatio?.top20PercentRacksTraffic}% lưu lượng
            </strong>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas shadows camera={{ position: [12.5, 11.5, 15.5], fov: 43 }}>
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={0.95} />
        <directionalLight position={[8, 13, 8]} intensity={1.2} castShadow />
        <directionalLight position={[-8, 7, -5]} intensity={0.35} />
        <WarehouseShell warehouseCode={warehouseCode} zoneCode={zoneCode} />
        {layout.map((rack) => {
          const heatInfo = heatmapData?.racks?.[rack.id] || heatmapData?.racks?.[rack.name];
          return (
            <WarehouseRack
              key={rack.id}
              rack={rack}
              position={rack.position}
              selected={rack.id === selectedRackId}
              highlighted={highlightedRackIds?.has(rack.id)}
              onSelect={onSelectRack}
              heatmapInfo={heatInfo}
              showHeatmap={showHeatmap}
            />
          );
        })}
        <OrbitControls
          makeDefault
          target={[0, 1.1, 0]}
          minDistance={7}
          maxDistance={32}
          maxPolarAngle={Math.PI / 2.04}
        />
      </Canvas>

      {/* Interactive Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-200 shadow-md text-[11px]">
        {showHeatmap ? (
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-red-500" /> Chỉ báo Heatmap:
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500 shadow-sm" />
              <strong>&gt; 80đ</strong> (Ùn tắc / Lấy nhiều)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-500 shadow-sm" />
              <strong>60–80đ</strong> (Tần suất cao)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500 shadow-sm" />
              <strong>30–60đ</strong> (Trung bình)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500 shadow-sm" />
              <strong>&lt; 30đ</strong> (Lưu kho tĩnh / Ít động)
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span className="font-semibold text-slate-800">Trạng thái kệ:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-400" /> Trống
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Đang sử dụng
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500" /> Gần đầy (≥80%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500" /> Đầy 20/20 ô
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500" /> Quá tải
            </span>
          </div>
        )}
        <div className="text-slate-400 text-[10px] hidden sm:block">
          Click kệ để phóng to chi tiết 20 ô · Kéo để xoay góc nhìn
        </div>
      </div>
    </div>
  );
}
