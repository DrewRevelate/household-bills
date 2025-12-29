import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MemberAvatar } from '@/components/MemberAvatar';
import type { Person, Bill } from '@/lib/types';
import { getUnpaidBillsForMember } from '@/lib/bill-utils';
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

interface PayShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Person | null;
  bills: Bill[];
  members: Person[];
  totalRemaining: number;
  onPayShare: (
    payments: { billId: string; amount: number }[]
  ) => void;
}

export function PayShareDialog({
  open,
  onOpenChange,
  member,
  bills,
  members,
  totalRemaining,
  onPayShare,
}: PayShareDialogProps) {
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  // Get unpaid bills for this member
  const unpaidBills = useMemo(() => {
    if (!member) return [];
    return getUnpaidBillsForMember(bills, members, member.id);
  }, [bills, members, member]);

  // Reset when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setPaymentAmount(totalRemaining.toFixed(2));
    }
    onOpenChange(newOpen);
  };

  const amount = parseFloat(paymentAmount) || 0;
  const isValid = amount > 0 && amount <= totalRemaining + 0.01;
  const isFullPayment = Math.abs(amount - totalRemaining) < 0.01;
  const isPartialPayment = amount > 0 && amount < totalRemaining - 0.01;

  // Calculate how the payment will be distributed across bills
  const paymentDistribution = useMemo(() => {
    if (!isValid) return [];

    let remaining = amount;
    const distribution: { billId: string; billName: string; share: number; paying: number }[] = [];

    // Distribute payment across unpaid bills (oldest first)
    for (const { bill, remaining: billRemaining } of unpaidBills) {
      if (remaining <= 0.01) break;

      const payingThisBill = Math.min(remaining, billRemaining);
      distribution.push({
        billId: bill.id,
        billName: bill.name,
        share: billRemaining,
        paying: Math.round(payingThisBill * 100) / 100,
      });
      remaining -= payingThisBill;
    }

    return distribution;
  }, [amount, isValid, unpaidBills]);

  const handleConfirm = () => {
    if (!isValid || !member) return;

    const payments = paymentDistribution.map((d) => ({
      billId: d.billId,
      amount: d.paying,
    }));

    onPayShare(payments);
    onOpenChange(false);
  };

  const payFullAmount = () => {
    setPaymentAmount(totalRemaining.toFixed(2));
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <MemberAvatar member={member} size="md" />
            Pay {member.name}'s Share
          </DialogTitle>
          <DialogDescription>
            Record a payment toward their monthly bills
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount owed summary */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Total owed this month</span>
              <span className="font-bold text-xl">${totalRemaining.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment amount input */}
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={totalRemaining}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-8 text-lg"
                  placeholder="0.00"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={payFullAmount}
                className="whitespace-nowrap"
              >
                Pay Full
              </Button>
            </div>
          </div>

          {/* Status message */}
          {amount > 0 && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                isFullPayment
                  ? 'bg-emerald-50 text-emerald-700'
                  : isPartialPayment
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isFullPayment ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">
                {isFullPayment
                  ? 'This will pay off all bills for this month'
                  : isPartialPayment
                  ? `$${(totalRemaining - amount).toFixed(2)} will remain after this payment`
                  : 'Enter a valid payment amount'}
              </span>
            </div>
          )}

          {/* Payment distribution preview */}
          {paymentDistribution.length > 0 && (
            <div className="space-y-2">
              <Label className="text-slate-500">Payment will be applied to:</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {paymentDistribution.map((item) => (
                  <div
                    key={item.billId}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm"
                  >
                    <span className="text-slate-700 truncate mr-2">{item.billName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-600 font-medium">
                        ${item.paying.toFixed(2)}
                      </span>
                      <span className="text-slate-400 text-xs">
                        of ${item.share.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            {isFullPayment ? 'Pay Full Amount' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
