import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges, Bounds, Text, Html } from '@react-three/drei';
import { mmToM } from '@/lib/viz/projection';
import { RACK_SPEC } from '@/lib/viz/rackLayout';
import { LOAD_STATUS_META } from '@/lib/viz/rackSafety';
import { api } from '@/api';
import { Flame, Layers } from 'lucide-react';

function getSlotHeatColor(score) {
  if (score > 80) {
    return { bg: '#ef4444', text: '#b91c1c', border: '#f87171', label: 'Cực nóng (Lấy nhiều)' };
  }
  if (score >= 60) {
    return { bg: '#f97316', text: '#c2410c', border: '#fb923c', label: 'Tần suất cao' };
  }
  if (score >= 30) {
    return { bg: '#eab308', text: '#a16207', border: '#facc15', label: 'Trung bình' };
  }
  return { bg: '#3b82f6', text: '#1d4ed8', border: '#60a5fa', label: 'Lưu kho tĩnh / Ít lấy' };
}

function RackCarton({ p, color, dimmed, highlighted, onSelectSlot }) {
  const position = [
    mmToM(p.xMm + p.dxMm / 2),
    mmToM(p.zMm + p.dzMm / 2),
    mmToM(p.yMm + p.dyMm / 2),
  ];
  const size = [mmToM(p.dxMm), mmToM(p.dzMm), mmToM(p.dyMm)];

  return (
    <mesh
      position={position}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelectSlot?.(p.rackSlotCode);
      }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={dimmed ? '#cbd5e1' : color || p.colorHex || '#94a3b8'}
        transparent={dimmed}
        opacity={dimmed ? 0.12 : highlighted === false ? 0.16 : 0.96}
        roughness={0.72}
      />
      <Edges color={highlighted ? '#0f172a' : '#64748b'} />
    </mesh>
  );
}

function Beam({ position, size, color }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.62} metalness={0.12} />
    </mesh>
  );
}

function RackFrame() {
  const bayW = mmToM(RACK_SPEC.bayWidthMm);
  const levelH = mmToM(RACK_SPEC.levelHeightMm);
  const depth = mmToM(RACK_SPEC.depthMm);
  const post = mmToM(RACK_SPEC.frameThicknessMm);
  const shelfT = mmToM(RACK_SPEC.shelfThicknessMm);
  const totalW = bayW * RACK_SPEC.bays;
  const totalH = levelH * RACK_SPEC.levels;
  const blue = '#1d4ed8';
  const orange = '#ea580c';
  const deck = '#64748b';

  const posts = [];
  for (let b = 0; b <= RACK_SPEC.bays; b += 1) {
    const x = b * bayW;
    posts.push(
      <Beam key={`pf-${b}`} position={[x, totalH / 2, 0]} size={[post, totalH + post, post]} color={blue} />,
      <Beam key={`pb-${b}`} position={[x, totalH / 2, depth]} size={[post, totalH + post, post]} color={blue} />,
    );
  }

  const levels = [];
  for (let l = 0; l <= RACK_SPEC.levels; l += 1) {
    const y = l * levelH;
    for (let b = 0; b < RACK_SPEC.bays; b += 1) {
      const x = b * bayW + bayW / 2;
      levels.push(
        <Beam key={`ff-${l}-${b}`} position={[x, y, 0]} size={[bayW, post, post]} color={orange} />,
        <Beam key={`fb-${l}-${b}`} position={[x, y, depth]} size={[bayW, post, post]} color={orange} />,
      );
    }
    if (l < RACK_SPEC.levels) {
      levels.push(
        <Beam key={`deck-${l}`} position={[totalW / 2, y + shelfT / 2, depth / 2]} size={[totalW, shelfT, depth]} color={deck} />,
      );
    }
  }

  return <group>{posts}{levels}</group>;
}

function SlotBox({ slot, metric, selected, onSelect, slotHeat, showHeatmap }) {
  const [hovered, setHovered] = useState(false);
  const bayW = mmToM(RACK_SPEC.bayWidthMm);
  const levelH = mmToM(RACK_SPEC.levelHeightMm);
  const depth = mmToM(RACK_SPEC.depthMm);
  const x = (slot.bay - 1) * bayW + bayW / 2;
  const y = (slot.level - 1) * levelH + levelH / 2;
  const occupied = slot.placements.length > 0;

  const slotScore = slotHeat?.score ?? 0;
  const heat = showHeatmap ? getSlotHeatColor(slotScore) : null;
  const status = metric?.status || (occupied ? 'active' : 'empty');
  const meta = LOAD_STATUS_META[status] || LOAD_STATUS_META.empty;

  const color = selected ? '#f59e0b' : showHeatmap ? heat.bg : meta.color;
  const opacity = selected
    ? 0.22
    : hovered
    ? 0.18
    : showHeatmap
    ? slotScore > 80
      ? 0.26
      : slotScore >= 60
      ? 0.18
      : slotScore >= 30
      ? 0.08
      : 0.035
    : status === 'overload' || status === 'near'
    ? 0.09
    : 0.025;

  return (
    <group>
      <mesh
        position={[x, y, depth / 2]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(slot.code);
        }}
      >
        <boxGeometry args={[bayW * 0.96, levelH * 0.88, depth * 0.96]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
        {(selected || hovered || showHeatmap || status === 'near' || status === 'overload') && (
          <Edges color={color} />
        )}
      </mesh>

      <Text
        position={[x, (slot.level - 1) * levelH + 0.11, -0.06]}
        fontSize={0.13}
        color={
          selected
            ? '#b45309'
            : showHeatmap
            ? slotScore > 80
              ? '#b91c1c'
              : slotScore >= 60
              ? '#c2410c'
              : '#334155'
            : status === 'overload'
            ? '#b91c1c'
            : status === 'near'
            ? '#b45309'
            : occupied
            ? '#166534'
            : '#64748b'
        }
        anchorX="center"
        anchorY="middle"
      >
        {slot.code} {showHeatmap ? `[${slotScore}đ]` : ''}
      </Text>

      {hovered && (
        <Html position={[x, y + levelH * 0.34, depth + 0.08]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <div className="rounded-lg border bg-white/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl text-[11px] whitespace-nowrap min-w-[210px] border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b pb-1.5 mb-1.5">
              <span className="font-bold text-slate-900">Ô {slot.code}</span>
              {showHeatmap ? (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: heat.bg }}
                >
                  {slotScore}/100đ · {slotHeat?.operations || 0} lượt
                </span>
              ) : (
                <span style={{ color: meta.color }} className="font-semibold">
                  {meta.label}
                </span>
              )}
            </div>

            <div className="text-slate-500 mt-0.5">Tầng {slot.level} · Khoang {slot.bay}</div>

            {showHeatmap ? (
              <div className="mt-1.5 space-y-1">
                <div className="text-slate-700">
                  <span>Tần suất lấy hàng: </span>
                  <strong className="text-slate-900">{slotHeat?.operations || 0} giao dịch</strong>
                </div>
                <div className="text-[10px] font-semibold" style={{ color: heat.text }}>
                  {slotScore > 80
                    ? '🔥 Golden Pick Zone (Lấy hàng dồn dập)'
                    : slotScore >= 60
                    ? '⚡ Tần suất luân chuyển cao'
                    : '💤 Ô lưu trữ tĩnh'}
                </div>
                <div className="text-slate-500 text-[10px] pt-0.5 border-t">
                  Tồn kho: {metric?.cartonCount || 0} thùng · {(metric?.weightKg || 0).toFixed(1)}/500 kg
                </div>
              </div>
            ) : (
              <div className="mt-1.5 text-slate-700">
                {metric?.cartonCount || 0} thùng · {(metric?.weightKg || 0).toFixed(1)} / 500 kg
              </div>
            )}

            {metric?.partNames?.length > 0 ? (
              <div className="mt-1 text-slate-500 max-w-[230px] overflow-hidden text-ellipsis">
                {metric.partNames.join(', ')}
              </div>
            ) : (
              <div className="mt-1 text-slate-400">Ô trống, sẵn sàng lưu hàng</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function RackScene3D({
  placements,
  slots,
  slotMetrics,
  visibleLevel,
  className,
  getColor,
  isDimmed,
  highlightedPartIds,
  selectedSlotCode,
  onSelectSlot,
  rackId,
  rackName,
  rackHeatmap: externalRackHeatmap,
  initialHeatmap = true,
}) {
  const [showHeatmap, setShowHeatmap] = useState(initialHeatmap);
  const [internalHeatmapData, setInternalHeatmapData] = useState(null);

  // Auto-fetch heatmap data if not passed from parent
  useEffect(() => {
    if (externalRackHeatmap) return;
    let cancelled = false;
    api.inventory
      .heatmap({ days: 90 })
      .then((data) => {
        if (!cancelled) setInternalHeatmapData(data);
      })
      .catch((err) => {
        console.warn('Failed to load rack heatmap in RackScene3D:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [externalRackHeatmap]);

  const currentRackHeat = useMemo(() => {
    if (externalRackHeatmap) return externalRackHeatmap;
    if (!internalHeatmapData?.racks) return null;
    // Match by rackId, rackName, or sample containerId in placements
    const candidateId = rackId || placements?.[0]?.containerId || placements?.[0]?.rackId;
    if (candidateId && internalHeatmapData.racks[candidateId]) {
      return internalHeatmapData.racks[candidateId];
    }
    if (rackName && internalHeatmapData.racks[rackName]) {
      return internalHeatmapData.racks[rackName];
    }
    // Fallback: use first rack or R01
    return internalHeatmapData.racks['R01'] || Object.values(internalHeatmapData.racks)[0] || null;
  }, [externalRackHeatmap, internalHeatmapData, rackId, rackName, placements]);

  const visible = useMemo(
    () => (visibleLevel === 'all' ? placements : placements.filter((p) => p.rackLevel <= visibleLevel)),
    [placements, visibleLevel],
  );

  const totalW = mmToM(RACK_SPEC.bayWidthMm * RACK_SPEC.bays);
  const totalH = mmToM(RACK_SPEC.levelHeightMm * RACK_SPEC.levels);
  const depth = mmToM(RACK_SPEC.depthMm);
  const hasSearch = highlightedPartIds && highlightedPartIds.size > 0;

  return (
    <div className={`relative ${className || ''}`} style={{ minHeight: 520, height: 520, width: '100%' }}>
      {/* HUD Control Switch */}
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
          Tải trọng ô
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
          Heatmap từng ô (Slot)
        </button>
      </div>

      {/* Heatmap Legend Bar in Rack View */}
      {showHeatmap && (
        <div className="absolute top-3 right-3 z-10 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 shadow-md text-[11px]">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-red-500" /> Điểm Heat ô:
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> &gt;80đ (Golden Zone)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> 60–80đ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> 30–60đ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> &lt;30đ
          </span>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas shadows style={{ width: '100%', height: '100%' }} camera={{ position: [totalW * 1.15, totalH * 0.95, depth * 3.1], fov: 42 }}>
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={0.86} />
        <directionalLight position={[8, 12, 8]} intensity={1.1} castShadow />
        <directionalLight position={[-5, 6, -4]} intensity={0.35} />

        <Bounds fit clip observe margin={1.1}>
          <RackFrame />
          {slots.map((slot) => {
            const slotHeat = currentRackHeat?.slots?.[slot.index] || currentRackHeat?.slots?.[slot.code];
            return (
              <SlotBox
                key={slot.code}
                slot={slot}
                metric={slotMetrics?.[slot.code]}
                selected={slot.code === selectedSlotCode}
                onSelect={onSelectSlot}
                slotHeat={slotHeat}
                showHeatmap={showHeatmap}
              />
            );
          })}
          {visible.map((p, index) => (
            <RackCarton
              key={`${p.partId}-${p.rackSlotIndex}-${index}`}
              p={p}
              color={getColor?.(p)}
              dimmed={isDimmed?.(p)}
              highlighted={hasSearch ? highlightedPartIds.has(p.partId) : true}
              onSelectSlot={onSelectSlot}
            />
          ))}
        </Bounds>

        <gridHelper args={[14, 28, '#cbd5e1', '#e2e8f0']} position={[totalW / 2, -0.02, depth / 2]} />
        <OrbitControls makeDefault target={[totalW / 2, totalH / 2, depth / 2]} />
      </Canvas>
    </div>
  );
}
