import { useEffect, useState } from 'react';
import { api } from '@/api';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export function useRackRecommendation(orderId, refreshKey) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setRecommendation(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.storage
      .recommendRack(orderId)
      .then((r) => { if (!cancelled) setRecommendation(r); })
      .catch(() => { if (!cancelled) setRecommendation(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, refreshKey]);

  return { recommendation, loading };
}

export default function RackRecommendationBanner({ recommendation, loading, rackTypes }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 px-0.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tính cấu hình kệ phù hợp...
      </div>
    );
  }
  if (!recommendation?.recommendedRackTypeId) return null;

  const recommended = rackTypes.find((t) => t.id === recommendation.recommendedRackTypeId);
  if (!recommended) return null;

  if (recommendation.fullyFits) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-700">
          Đề xuất: <strong>{recommended.label}</strong> — đủ sức chứa {recommendation.cartonCount} thùng.
        </p>
      </div>
    );
  }

  const best = recommendation.candidates.find((c) => c.rackTypeId === recommendation.recommendedRackTypeId);
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-700">
        Một kệ chưa đủ cho {recommendation.cartonCount} thùng. Đề xuất dùng <strong>{recommended.label}</strong> trước
        {' '}(xếp được {best?.placedCartonCount ?? 0}/{recommendation.cartonCount} thùng), sau đó bổ sung kệ tiếp theo.
      </p>
    </div>
  );
}
