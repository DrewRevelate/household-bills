import { useMemo, useState } from 'react';
import type { Bill, Person } from '@/lib/types';
import type { MemberMonthlyBill } from '@/lib/bill-utils';
import { calculateMonthlyMemberBills } from '@/lib/bill-utils';
import { MemberAvatar } from './MemberAvatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, CheckCircle, DollarSign } from 'lucide-react';

interface MemberBillsCardProps {
  bills: Bill[];
  members: Person[];
  month: number; // 0-11
  year: number;
  onPayShare?: (memberId: string, memberName: string, remaining: number) => void;
}

export function MemberBillsCard({ bills, members, month, year, onPayShare }: MemberBillsCardProps) {
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<MemberMonthlyBill | null>(null);

  const memberBills = useMemo(
    () => calculateMonthlyMemberBills(bills, members, month, year),
    [bills, members, month, year]
  );

  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getMember = (id: string) => members.find((m) => m.id === id);

  const toggleExpand = (memberId: string) => {
    setExpandedMember(expandedMember === memberId ? null : memberId);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/50 overflow-hidden card-shadow">
      <div className="p-5 border-b border-slate-100/50 bg-gradient-to-r from-indigo-50/50 to-violet-50/50">
        <h3 className="font-semibold text-slate-900 text-xl">Member Bills</h3>
        <p className="text-slate-500 text-sm mt-1">{monthName}</p>
      </div>

      <div className="divide-y divide-slate-100/50">
        {memberBills.map((memberBill) => {
          const member = getMember(memberBill.memberId);
          if (!member) return null;

          const progress = memberBill.totalShare > 0
            ? Math.round((memberBill.amountPaid / memberBill.totalShare) * 100)
            : 100;
          const isFullyPaid = memberBill.remaining < 0.01;
          const isExpanded = expandedMember === memberBill.memberId;

          return (
            <div key={memberBill.memberId} className="p-4">
              {/* Main row */}
              <div className="flex items-center gap-4">
                <MemberAvatar member={member} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                    {isFullyPaid && (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-slate-500">
                      ${memberBill.amountPaid.toFixed(2)} / ${memberBill.totalShare.toFixed(2)}
                    </span>
                    <Progress value={progress} className="h-2 w-20" />
                  </div>
                </div>

                <div className="text-right">
                  {isFullyPaid ? (
                    <span className="text-emerald-600 font-semibold">Paid</span>
                  ) : (
                    <>
                      <p className="font-bold text-slate-900 text-lg tabular-nums">
                        ${memberBill.remaining.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400">remaining</p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isFullyPaid && onPayShare && (
                    <Button
                      size="sm"
                      onClick={() => onPayShare(memberBill.memberId, member.name, memberBill.remaining)}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Pay
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(memberBill.memberId)}
                    className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Expanded breakdown */}
              {isExpanded && memberBill.billBreakdown.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 ml-12 space-y-2"
                >
                  {memberBill.billBreakdown.map((item) => (
                    <div
                      key={item.billId}
                      className="flex items-center justify-between text-sm p-3 bg-gradient-to-r from-slate-50 to-slate-50/50 rounded-lg border border-slate-100/50"
                    >
                      <div className="flex items-center gap-2">
                        {item.remaining < 0.01 ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-indigo-300" />
                        )}
                        <span className={item.remaining < 0.01 ? 'text-slate-400' : 'text-slate-700'}>
                          {item.billName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={item.remaining < 0.01 ? 'text-emerald-600' : 'text-slate-900 font-medium'}>
                          {item.remaining < 0.01 ? 'Paid' : `$${item.remaining.toFixed(2)}`}
                        </span>
                        <span className="text-slate-400 text-xs ml-2">
                          of ${item.share.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setDetailMember(memberBill)}
                    className="text-sm text-indigo-500 hover:text-indigo-700 font-medium mt-2 transition-colors"
                  >
                    View full breakdown
                  </button>
                </motion.div>
              )}
            </div>
          );
        })}

        {memberBills.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No bills for {monthName}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailMember} onOpenChange={(open) => !open && setDetailMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {detailMember && getMember(detailMember.memberId) && (
                <MemberAvatar member={getMember(detailMember.memberId)!} size="md" />
              )}
              {detailMember?.memberName}'s {monthName} Bill
            </DialogTitle>
            <DialogDescription>
              Breakdown of all bills for this month
            </DialogDescription>
          </DialogHeader>

          {detailMember && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl p-4 space-y-2 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total bill</span>
                  <span className="font-semibold">${detailMember.totalShare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Paid</span>
                  <span className="font-semibold text-emerald-600">${detailMember.amountPaid.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200/50 pt-2 flex justify-between">
                  <span className="text-slate-900 font-medium">Remaining</span>
                  <span className="font-bold text-lg">${detailMember.remaining.toFixed(2)}</span>
                </div>
              </div>

              {/* Bill list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {detailMember.billBreakdown.map((item) => (
                  <div
                    key={item.billId}
                    className="flex items-center justify-between p-3 border border-slate-200/50 rounded-xl bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{item.billName}</p>
                      <p className="text-xs text-slate-400">
                        Due {new Date(item.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {item.remaining < 0.01 ? (
                          <span className="text-emerald-600">Paid</span>
                        ) : (
                          <span>${item.remaining.toFixed(2)}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">of ${item.share.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pay button */}
              {detailMember.remaining > 0.01 && onPayShare && (
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
                  onClick={() => {
                    onPayShare(detailMember.memberId, detailMember.memberName, detailMember.remaining);
                    setDetailMember(null);
                  }}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Pay ${detailMember.remaining.toFixed(2)}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
