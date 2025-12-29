import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Bill, Person } from '@/lib/types';
import { getBillPaidAmount, getBillRemainingAmount, getBillStatus } from '@/lib/types';
import { MemberAvatar } from './MemberAvatar';
import { CheckCircle, Clock, DollarSign, Pencil, Trash2, X, Check, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentBreakdownDialogProps {
  bill: Bill | null;
  members: Person[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePayment?: (billId: string, personId: string, newAmount: number) => Promise<void>;
  onDeletePayment?: (billId: string, personId: string) => Promise<void>;
  onUpdatePaidDate?: (billId: string, paidDate: string) => Promise<void>;
  onUpdateContributionDate?: (billId: string, personId: string, date: string) => Promise<void>;
}

export function PaymentBreakdownDialog({
  bill,
  members,
  open,
  onOpenChange,
  onUpdatePayment,
  onDeletePayment,
  onUpdatePaidDate,
  onUpdateContributionDate,
}: PaymentBreakdownDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  if (!bill) return null;

  const status = getBillStatus(bill);
  const totalPaid = getBillPaidAmount(bill);
  const remaining = getBillRemainingAmount(bill);
  const isPartial = status === 'partial';

  // Get payment contributions
  const getContributions = (): { member: Person; amount: number }[] => {
    const contributions: { member: Person; amount: number }[] = [];

    if (bill.paidContributions) {
      Object.entries(bill.paidContributions).forEach(([personId, amount]) => {
        const member = members.find((m) => m.id === personId);
        if (member && amount > 0) {
          contributions.push({ member, amount });
        }
      });
    } else if (bill.paidBy) {
      const member = members.find((m) => m.id === bill.paidBy);
      if (member) {
        contributions.push({ member, amount: bill.amount });
      }
    }

    return contributions.sort((a, b) => b.amount - a.amount);
  };

  const contributions = getContributions();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const startEdit = (memberId: string, currentAmount: number) => {
    setEditingId(memberId);
    setEditAmount(currentAmount.toFixed(2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount('');
  };

  const saveEdit = async (memberId: string) => {
    const newAmount = parseFloat(editAmount);
    if (!isNaN(newAmount) && newAmount >= 0 && onUpdatePayment) {
      await onUpdatePayment(bill.id, memberId, newAmount);
    }
    setEditingId(null);
    setEditAmount('');
  };

  const handleDelete = async (memberId: string) => {
    if (onDeletePayment) {
      await onDeletePayment(bill.id, memberId);
    }
  };

  const handlePaidDateChange = async (date: Date | undefined) => {
    if (date && onUpdatePaidDate) {
      await onUpdatePaidDate(bill.id, date.toISOString());
      setDatePickerOpen(false);
    }
  };

  const handleContributionDateChange = async (personId: string, date: Date | undefined) => {
    if (date && onUpdateContributionDate) {
      await onUpdateContributionDate(bill.id, personId, date.toISOString());
      setEditingDateId(null);
    }
  };

  const getContributionDate = (personId: string): Date | undefined => {
    const dateStr = bill.contributionDates?.[personId];
    return dateStr ? new Date(dateStr) : undefined;
  };

  const paidDateObj = bill.paidDate ? new Date(bill.paidDate) : undefined;

  // Safe date formatter that handles invalid dates
  const safeFormatDate = (date: Date | undefined): string => {
    if (!date || isNaN(date.getTime())) return 'Set date';
    return format(date, 'MMM d, yyyy');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            {isPartial ? (
              <Clock className="w-6 h-6 text-blue-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            )}
            {bill.name}
          </DialogTitle>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-slate-900">
              ${bill.amount.toFixed(2)}
            </span>
          </div>
          {/* Bill paid date (when paid to vendor) */}
          {(status === 'paid') && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-lg text-slate-500">Bill paid</span>
              {onUpdatePaidDate ? (
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="text-lg text-slate-600 hover:text-slate-900 h-auto px-2 py-1 gap-1"
                    >
                      <CalendarIcon className="w-4 h-4" />
                      {safeFormatDate(paidDateObj)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paidDateObj}
                      onSelect={handlePaidDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="text-lg text-slate-600">
                  {formatDate(bill.paidDate)}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Payment summary for partial */}
          {isPartial && (
            <div className="flex gap-4 p-4 bg-blue-50 rounded-xl">
              <div className="flex-1">
                <p className="text-sm text-blue-600 font-medium">Paid</p>
                <p className="text-xl font-bold text-blue-700">${totalPaid.toFixed(2)}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-blue-600 font-medium">Remaining</p>
                <p className="text-xl font-bold text-blue-700">${remaining.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Contributors list */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
              {contributions.length === 1 ? 'Paid by' : 'Contributors'}
            </h3>
            <div className="space-y-3">
              {contributions.map(({ member, amount }) => {
                const isEditing = editingId === member.id;
                const contributionDate = getContributionDate(member.id);
                const isEditingDate = editingDateId === member.id;

                return (
                  <div
                    key={member.id}
                    className="p-4 bg-slate-50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <MemberAvatar member={member} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-xl">{member.name}</p>
                        {!isEditing && (
                          <p className="text-lg text-slate-500">
                            {((amount / bill.amount) * 100).toFixed(0)}% of bill
                          </p>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            <DollarSign className="w-5 h-5 text-slate-400" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-28 text-right text-lg h-12"
                              autoFocus
                            />
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => saveEdit(member.id)}
                            className="h-12 w-12 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Check className="w-6 h-6" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEdit}
                            className="h-12 w-12 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-6 h-6" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-2xl text-emerald-600 flex items-center gap-1">
                            <DollarSign className="w-6 h-6" />
                            {amount.toFixed(2)}
                          </p>
                          {onUpdatePayment && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEdit(member.id, amount)}
                              className="h-10 w-10 text-slate-400 hover:text-slate-600"
                            >
                              <Pencil className="w-5 h-5" />
                            </Button>
                          )}
                          {onDeletePayment && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(member.id)}
                              className="h-10 w-10 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Contribution date */}
                    {!isEditing && (
                      <div className="mt-2 ml-16 flex items-center gap-1">
                        <span className="text-sm text-slate-400">Contributed</span>
                        {onUpdateContributionDate ? (
                          <Popover open={isEditingDate} onOpenChange={(open) => setEditingDateId(open ? member.id : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                className="text-sm text-slate-500 hover:text-slate-700 h-auto px-1.5 py-0.5 gap-1"
                              >
                                <CalendarIcon className="w-3 h-3" />
                                {safeFormatDate(contributionDate)}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={contributionDate}
                                onSelect={(date) => handleContributionDateChange(member.id, date)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          contributionDate && !isNaN(contributionDate.getTime()) && (
                            <span className="text-sm text-slate-500">
                              {format(contributionDate, 'MMM d, yyyy')}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remaining unpaid section for partial */}
          {isPartial && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <p className="font-medium text-amber-800">
                  ${remaining.toFixed(2)} still unpaid
                </p>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                Tap "Add Payment" on this bill to record more contributions
              </p>
            </div>
          )}

          {/* No payments state */}
          {contributions.length === 0 && (
            <div className="p-4 bg-slate-100 rounded-xl text-center">
              <p className="text-slate-500">No payments recorded yet</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
