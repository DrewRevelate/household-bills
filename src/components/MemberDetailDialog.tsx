import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Bill, Person } from '@/lib/types';
import { MemberAvatar } from './MemberAvatar';
import { DollarSign, Coins, Receipt, TrendingUp, TrendingDown, ChevronRight, Smartphone } from 'lucide-react';
import { calculateBillShares } from '@/lib/hooks';

interface MemberDetailDialogProps {
  member: Person | null;
  members: Person[];
  bills: Bill[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBillClick?: (bill: Bill) => void;
}

export function MemberDetailDialog({
  member,
  members,
  bills,
  open,
  onOpenChange,
  onBillClick,
}: MemberDetailDialogProps) {
  if (!member) return null;

  // Get all bills this member has contributed to
  const paidBills = bills.filter((bill) => {
    if (!bill.isPaid && !bill.paidContributions) return false;
    if (bill.paidContributions && bill.paidContributions[member.id]) return true;
    if (bill.paidBy === member.id) return true;
    return false;
  });

  // Calculate payment details for each bill
  const paymentDetails = paidBills.map((bill) => {
    const amountPaid = bill.paidContributions?.[member.id] || (bill.paidBy === member.id ? bill.amount : 0);
    const shares = calculateBillShares(bill, members);
    const theirShare = shares[member.id] || 0;
    const difference = amountPaid - theirShare;

    return {
      bill,
      amountPaid,
      theirShare,
      difference, // positive = overpaid (credit), negative = underpaid
      date: bill.paidDate,
    };
  }).sort((a, b) => {
    // Sort by date, newest first
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Calculate totals
  const totalPaid = paymentDetails.reduce((sum, d) => sum + d.amountPaid, 0);
  const totalShare = paymentDetails.reduce((sum, d) => sum + d.theirShare, 0);
  const totalOverpaid = paymentDetails.reduce((sum, d) => sum + Math.max(0, d.difference), 0);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <MemberAvatar member={member} size="xl" />
            <div>
              <DialogTitle className="text-2xl">{member.name}</DialogTitle>
              <p className="text-slate-500 text-lg">${member.mortgageShare}/mo mortgage share</p>
              {member.venmoHandle && (
                <a
                  href={`https://account.venmo.com/u/${member.venmoHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-2 mt-1"
                >
                  <Smartphone className="w-4 h-4" />
                  Pay @{member.venmoHandle}
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Credit Balance */}
            <div className="p-4 bg-violet-50 rounded-xl">
              <div className="flex items-center gap-2 text-violet-600 mb-1">
                <Coins className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wide">Credit Balance</span>
              </div>
              <p className="text-3xl font-bold text-violet-700">
                ${(member.credit || 0).toFixed(2)}
              </p>
              <p className="text-sm text-violet-600 mt-1">
                Available to use on bills
              </p>
            </div>

            {/* Total Paid */}
            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <DollarSign className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wide">Total Paid</span>
              </div>
              <p className="text-3xl font-bold text-emerald-700">
                ${totalPaid.toFixed(2)}
              </p>
              <p className="text-sm text-emerald-600 mt-1">
                Across {paidBills.length} bill{paidBills.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex gap-4 p-4 bg-slate-50 rounded-xl">
            <div className="flex-1 text-center">
              <p className="text-sm text-slate-500">Their Share</p>
              <p className="text-xl font-bold text-slate-700">${totalShare.toFixed(2)}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div className="flex-1 text-center">
              <p className="text-sm text-slate-500">Overpaid</p>
              <p className="text-xl font-bold text-violet-600">${totalOverpaid.toFixed(2)}</p>
            </div>
          </div>

          {/* Payment History */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Payment History
            </h3>

            {paymentDetails.length > 0 ? (
              <div className="space-y-2">
                {paymentDetails.map(({ bill, amountPaid, theirShare, difference, date }) => (
                  <div
                    key={bill.id}
                    className={`p-4 bg-white border border-slate-200 rounded-xl transition-colors ${
                      onBillClick ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-300' : ''
                    }`}
                    onClick={() => onBillClick?.(bill)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{bill.name}</p>
                          {onBillClick && (
                            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          {date ? formatDate(date) : 'No date'} · Bill total: ${bill.amount.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-lg text-emerald-600">
                          ${amountPaid.toFixed(2)}
                        </p>
                        <p className="text-sm text-slate-500">
                          paid
                        </p>
                      </div>
                    </div>

                    {/* Share comparison */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-sm">
                      <div className="flex-1">
                        <span className="text-slate-500">Share: </span>
                        <span className="font-medium">${theirShare.toFixed(2)}</span>
                      </div>
                      {Math.abs(difference) > 0.01 && (
                        <div className={`flex items-center gap-1 ${
                          difference > 0 ? 'text-violet-600' : 'text-amber-600'
                        }`}>
                          {difference > 0 ? (
                            <>
                              <TrendingUp className="w-4 h-4" />
                              <span className="font-medium">+${difference.toFixed(2)} overpaid</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-4 h-4" />
                              <span className="font-medium">${Math.abs(difference).toFixed(2)} under share</span>
                            </>
                          )}
                        </div>
                      )}
                      {Math.abs(difference) <= 0.01 && (
                        <span className="text-emerald-600 font-medium">Exact share</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-xl text-center">
                <p className="text-slate-500">No payment history yet</p>
              </div>
            )}
          </div>

          {/* Credit explanation */}
          {(member.credit || 0) > 0 && (
            <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
              <p className="text-sm text-violet-700">
                <strong>How credit works:</strong> Credit is earned when {member.name} pays more than their share on a bill.
                This credit can be applied to future bills, but cannot be used to settle debts owed to other household members.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
