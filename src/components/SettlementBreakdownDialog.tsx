import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BILL_CATEGORIES, type SettlementWithBreakdown, type SettlementBreakdown } from '@/lib/types';
import {
  Home,
  Zap,
  Shield,
  Tv,
  ShoppingCart,
  Wifi,
  Car,
  HeartPulse,
  FileText,
  ArrowUp,
  ArrowDown,
  Minus,
  Gift,
} from 'lucide-react';

const categoryIcons: Record<string, React.ElementType> = {
  mortgage: Home,
  utility: Zap,
  insurance: Shield,
  subscription: Tv,
  groceries: ShoppingCart,
  internet: Wifi,
  transportation: Car,
  medical: HeartPulse,
  other: FileText,
};

interface SettlementBreakdownDialogProps {
  settlement: SettlementWithBreakdown | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BillItem({ item, direction }: { item: SettlementBreakdown; direction: 'owed' | 'offset' }) {
  const Icon = categoryIcons[item.category] || FileText;
  const getCategoryLabel = (category: string) => {
    return BILL_CATEGORIES.find((c) => c.value === category)?.label || category;
  };
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        direction === 'owed'
          ? 'bg-red-50 border-red-100'
          : 'bg-emerald-50 border-emerald-100'
      }`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        direction === 'owed' ? 'bg-red-100' : 'bg-emerald-100'
      }`}>
        <Icon className={`w-5 h-5 ${direction === 'owed' ? 'text-red-600' : 'text-emerald-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">
          {item.billName}
        </p>
        <p className="text-sm text-slate-500">
          {getCategoryLabel(item.category)} · {formatDate(item.dueDate)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`font-semibold ${direction === 'owed' ? 'text-red-600' : 'text-emerald-600'}`}>
          {direction === 'owed' ? '+' : '-'}${item.creditorPaid.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

export function SettlementBreakdownDialog({
  settlement,
  open,
  onOpenChange,
}: SettlementBreakdownDialogProps) {
  if (!settlement) return null;

  const hasOffset = settlement.offsetBreakdown && settlement.offsetBreakdown.length > 0;
  const hasForgiven = settlement.forgiven && settlement.forgiven > 0.01;
  const hasAdjustments = hasOffset || hasForgiven;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {settlement.from} owes {settlement.to}
          </DialogTitle>
          <p className="text-2xl font-bold text-emerald-600">
            ${settlement.amount.toFixed(2)}
            {hasAdjustments && (
              <span className="text-sm font-normal text-slate-500 ml-2">(after adjustments)</span>
            )}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {/* Bills where From owes To */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUp className="w-4 h-4 text-red-500" />
              <h3 className="font-semibold text-slate-700">
                {settlement.from} owed {settlement.to}
              </h3>
              <span className="ml-auto text-red-600 font-semibold">
                ${settlement.grossOwed?.toFixed(2) || settlement.amount.toFixed(2)}
              </span>
            </div>
            <div className="space-y-2">
              {settlement.breakdown.map((item, index) => (
                <BillItem key={`owed-${item.billId}-${index}`} item={item} direction="owed" />
              ))}
            </div>
          </div>

          {/* Bills where To owes From (offset) */}
          {hasOffset && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-slate-700">
                  {settlement.to} owed {settlement.from}
                </h3>
                <span className="ml-auto text-emerald-600 font-semibold">
                  -${settlement.grossOffset?.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2">
                {settlement.offsetBreakdown!.map((item, index) => (
                  <BillItem key={`offset-${item.billId}-${index}`} item={item} direction="offset" />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-4 mt-4 -mx-6 px-6 space-y-2">
          {hasAdjustments && (
            <>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{settlement.from} owed {settlement.to}</span>
                <span className="text-red-600">+${settlement.grossOwed?.toFixed(2)}</span>
              </div>
              {hasOffset && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{settlement.to} owed {settlement.from}</span>
                  <span className="text-emerald-600">-${settlement.grossOffset?.toFixed(2)}</span>
                </div>
              )}
              {hasForgiven && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-violet-600 flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    {settlement.to} forgave
                  </span>
                  <span className="text-violet-600">-${settlement.forgiven?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Minus className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 font-medium">Net Amount</span>
                <span className="ml-auto text-xl font-bold text-emerald-600">
                  ${settlement.amount.toFixed(2)}
                </span>
              </div>
            </>
          )}
          {!hasAdjustments && (
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Total</span>
              <span className="text-xl font-bold text-emerald-600">
                ${settlement.amount.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
