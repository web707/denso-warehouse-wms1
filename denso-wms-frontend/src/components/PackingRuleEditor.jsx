import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';

export default function PackingRuleEditor() {
  const { packingRules, addRule, updateRule, deleteRule } = useStore();

  return (
    <div className="space-y-2">
      {packingRules.map((rule) => (
        <div
          key={rule.id}
          className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition group"
        >
          <Switch
            checked={rule.active !== false}
            onCheckedChange={(v) => updateRule(rule.id, { active: v })}
          />
          <Input
            value={rule.text}
            onChange={(e) => updateRule(rule.id, { text: e.target.value })}
            className="flex-1 h-8 text-sm"
            placeholder="Nội dung quy ước..."
          />
          <Input
            value={rule.category}
            onChange={(e) => updateRule(rule.id, { category: e.target.value })}
            className="w-[130px] h-8 text-xs"
            placeholder="Danh mục"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
            onClick={() => deleteRule(rule.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => addRule({ text: 'Quy ước đóng hàng mới', category: 'Khác', icon: 'Box', active: true })}
      >
        <Plus className="w-4 h-4 mr-1.5" /> Thêm quy ước
      </Button>
    </div>
  );
}