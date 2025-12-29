import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MemberAvatar } from '@/components/MemberAvatar';
import type { Person, Bill, CoverageAllocation } from '@/lib/types';
import { calculateBillShares } from '@/lib/hooks';
import { Users, DollarSign, Coins, Plus, UserPlus, Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface MultiPayerDialogProps {
  bill: Bill | null;
  members: Person[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    paidBy: string | null,
    contributions: Record<string, number> | undefined,
    creditUsed?: Record<string, number>,
    overpayments?: Record<string, number>,
    coverageAllocations?: CoverageAllocation[],
    paidDate?: string,
    contributionDates?: Record<string, string>
  ) => void;
}

export function MultiPayerDialog({
  bill,
  members,
  open,
  onOpenChange,
  onConfirm,
}: MultiPayerDialogProps) {
  const [selectedPayers, setSelectedPayers] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [creditToUse, setCreditToUse] = useState<Record<string, string>>({});
  // Track who each payer is covering (payerId -> coveredId)
  const [coveringFor, setCoveringFor] = useState<Record<string, string>>({});
  // Paid date - defaults to today
  const [paidDate, setPaidDate] = useState<Date>(new Date());

  // Calculate shares for each member on this bill
  const shares = useMemo(() => {
    if (!bill) return {};
    return calculateBillShares(bill, members);
  }, [bill, members]);

  // Calculate existing paid amount for partial bills
  const existingPaidAmount = bill?.paidContributions
    ? Object.values(bill.paidContributions).reduce((sum, amt) => sum + amt, 0)
    : 0;
  const remainingAmount = bill ? bill.amount - existingPaidAmount : 0;

  // Reset state when dialog opens with new bill
  useEffect(() => {
    if (open && bill) {
      setSelectedPayers(new Set());
      setAmounts({});
      setCreditToUse({});
      setCoveringFor({});
      setPaidDate(new Date()); // Reset to today
    }
  }, [open, bill?.id]);

  const totalEntered = useMemo(() => {
    return Array.from(selectedPayers).reduce((sum, id) => {
      const amount = parseFloat(amounts[id] || '0');
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [selectedPayers, amounts]);

  const totalCreditUsed = useMemo(() => {
    return Array.from(selectedPayers).reduce((sum, id) => {
      const credit = parseFloat(creditToUse[id] || '0');
      return sum + (isNaN(credit) ? 0 : credit);
    }, 0);
  }, [selectedPayers, creditToUse]);

  const billAmount = bill?.amount || 0;
  // For partial bills, calculate remaining against what's left to pay
  const targetAmount = existingPaidAmount > 0 ? remainingAmount : billAmount;
  const totalPayment = totalEntered + totalCreditUsed;
  const remaining = targetAmount - totalPayment;
  const isFullPayment = Math.abs(remaining) < 0.01;
  const isPartialPayment = totalPayment > 0 && remaining > 0.01;
  const isOverpayment = remaining < -0.01;
  const overpaymentAmount = isOverpayment ? Math.abs(remaining) : 0;
  const isValid = selectedPayers.size > 0 && totalPayment > 0;

  // Calculate which payers are paying more than their share
  const payersOverShare = useMemo(() => {
    const result: { payerId: string; excess: number; share: number }[] = [];
    selectedPayers.forEach((payerId) => {
      const payerShare = shares[payerId] || 0;
      const payerAmount = parseFloat(amounts[payerId] || '0') + parseFloat(creditToUse[payerId] || '0');
      if (payerAmount > payerShare + 0.01) {
        result.push({ payerId, excess: payerAmount - payerShare, share: payerShare });
      }
    });
    return result;
  }, [selectedPayers, shares, amounts, creditToUse]);

  // Members who could be covered (not paying or paying less than share)
  const membersNeedingCoverage = useMemo(() => {
    return members.filter((m) => {
      const theirShare = shares[m.id] || 0;
      if (theirShare < 0.01) return false; // No share to cover
      const theirPayment = selectedPayers.has(m.id)
        ? parseFloat(amounts[m.id] || '0') + parseFloat(creditToUse[m.id] || '0')
        : 0;
      return theirPayment < theirShare - 0.01; // Not fully paying their share
    });
  }, [members, shares, selectedPayers, amounts, creditToUse]);

  // Auto-split amounts evenly among selected payers
  const recalculateAmounts = (selected: Set<string>) => {
    if (selected.size === 0) {
      setAmounts({});
      return;
    }

    // Calculate total credit being used by selected members
    const totalCredit = Array.from(selected).reduce((sum, id) => {
      const credit = parseFloat(creditToUse[id] || '0');
      return sum + (isNaN(credit) ? 0 : credit);
    }, 0);

    // Amount to split is target minus any credit being used
    const amountToSplit = Math.max(0, targetAmount - totalCredit);
    const perPerson = (amountToSplit / selected.size).toFixed(2);

    const newAmounts: Record<string, string> = {};
    selected.forEach((id) => {
      newAmounts[id] = perPerson;
    });
    setAmounts(newAmounts);
  };

  const togglePayer = (memberId: string) => {
    const newSelected = new Set(selectedPayers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
      const newCredit = { ...creditToUse };
      delete newCredit[memberId];
      setCreditToUse(newCredit);
      // Also clear any coverage assignment for this payer
      const newCovering = { ...coveringFor };
      delete newCovering[memberId];
      setCoveringFor(newCovering);
    } else {
      newSelected.add(memberId);
    }
    setSelectedPayers(newSelected);
    recalculateAmounts(newSelected);
  };

  const handleAmountChange = (memberId: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [memberId]: value }));
  };

  const handleCreditChange = (memberId: string, value: string) => {
    const member = members.find((m) => m.id === memberId);
    const maxCredit = member?.credit || 0;
    const numValue = parseFloat(value) || 0;
    // Cap at available credit
    const cappedValue = Math.min(numValue, maxCredit);
    const newCreditToUse = { ...creditToUse, [memberId]: cappedValue > 0 ? cappedValue.toString() : '' };
    setCreditToUse(newCreditToUse);

    // Recalculate amounts with new credit values
    const totalCredit = Array.from(selectedPayers).reduce((sum, id) => {
      const credit = parseFloat(newCreditToUse[id] || '0');
      return sum + (isNaN(credit) ? 0 : credit);
    }, 0);
    const amountToSplit = Math.max(0, targetAmount - totalCredit);
    const perPerson = (amountToSplit / selectedPayers.size).toFixed(2);
    const newAmounts: Record<string, string> = {};
    selectedPayers.forEach((id) => {
      newAmounts[id] = perPerson;
    });
    setAmounts(newAmounts);
  };

  const useAllCredit = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    const availableCredit = member?.credit || 0;
    if (availableCredit > 0) {
      handleCreditChange(memberId, availableCredit.toFixed(2));
    }
  };

  const splitEvenly = () => {
    if (selectedPayers.size === 0) return;
    const perPerson = (targetAmount / selectedPayers.size).toFixed(2);
    const newAmounts: Record<string, string> = {};
    selectedPayers.forEach((id) => {
      newAmounts[id] = perPerson;
    });
    setAmounts(newAmounts);
  };

  const handleCoverageChange = (payerId: string, coveredId: string | null) => {
    if (coveredId) {
      setCoveringFor((prev) => ({ ...prev, [payerId]: coveredId }));
    } else {
      setCoveringFor((prev) => {
        const next = { ...prev };
        delete next[payerId];
        return next;
      });
    }
  };

  const handleConfirm = () => {
    if (!isValid) return;

    // Build contributions (total payments including credit)
    const contributions: Record<string, number> = {};
    selectedPayers.forEach((id) => {
      const cashAmount = parseFloat(amounts[id] || '0');
      const creditAmount = parseFloat(creditToUse[id] || '0');
      const total = cashAmount + creditAmount;
      if (total > 0) {
        contributions[id] = total;
      }
    });

    // Build credit used map
    const creditUsedMap: Record<string, number> = {};
    selectedPayers.forEach((id) => {
      const credit = parseFloat(creditToUse[id] || '0');
      if (credit > 0) {
        creditUsedMap[id] = credit;
      }
    });

    // Build coverage allocations
    // Default behavior: cover everyone proportionally (unless explicitly set to "_credit")
    const coverageAllocations: CoverageAllocation[] = [];
    payersOverShare.forEach(({ payerId, excess }) => {
      const coverageChoice = coveringFor[payerId];

      // If explicitly set to credit, skip coverage
      if (coverageChoice === '_credit') {
        return;
      }

      // If covering a specific person
      if (coverageChoice && coverageChoice !== '_cover_all') {
        const coveredShare = shares[coverageChoice] || 0;
        const coveredPayment = selectedPayers.has(coverageChoice)
          ? parseFloat(amounts[coverageChoice] || '0') + parseFloat(creditToUse[coverageChoice] || '0')
          : 0;
        const shortfall = Math.max(0, coveredShare - coveredPayment);
        const coverAmount = Math.min(excess, shortfall);
        if (coverAmount > 0.01) {
          coverageAllocations.push({
            payerId,
            coveredId: coverageChoice,
            amount: Math.round(coverAmount * 100) / 100,
          });
        }
        return;
      }

      // Default: Cover everyone (when no selection or "_cover_all")
      // Calculate total shortfall across all members needing coverage
      const shortfalls: { memberId: string; shortfall: number }[] = [];
      let totalShortfall = 0;

      membersNeedingCoverage
        .filter((m) => m.id !== payerId)
        .forEach((m) => {
          const theirShare = shares[m.id] || 0;
          const theirPayment = selectedPayers.has(m.id)
            ? parseFloat(amounts[m.id] || '0') + parseFloat(creditToUse[m.id] || '0')
            : 0;
          const shortfall = Math.max(0, theirShare - theirPayment);
          if (shortfall > 0.01) {
            shortfalls.push({ memberId: m.id, shortfall });
            totalShortfall += shortfall;
          }
        });

      // Distribute excess to cover shortfalls
      if (totalShortfall > 0.01) {
        // If excess covers everyone fully, give each person their full shortfall
        // Otherwise distribute proportionally
        if (excess >= totalShortfall - 0.01) {
          // Fully cover everyone
          shortfalls.forEach(({ memberId, shortfall }) => {
            coverageAllocations.push({
              payerId,
              coveredId: memberId,
              amount: Math.round(shortfall * 100) / 100,
            });
          });
        } else {
          // Partial coverage - distribute proportionally
          shortfalls.forEach(({ memberId, shortfall }) => {
            const proportion = shortfall / totalShortfall;
            const coverAmount = excess * proportion;
            if (coverAmount > 0.01) {
              coverageAllocations.push({
                payerId,
                coveredId: memberId,
                amount: Math.round(coverAmount * 100) / 100,
              });
            }
          });
        }
      }
    });

    // Calculate total overpayment (excess not assigned as coverage)
    const totalCoverage = coverageAllocations.reduce((sum, c) => sum + c.amount, 0);
    const totalExcess = payersOverShare.reduce((sum, p) => sum + p.excess, 0);
    const uncoveredExcess = Math.max(0, totalExcess - totalCoverage);

    // Convert paidDate to ISO string
    const paidDateISO = paidDate.toISOString();

    // Build contribution dates for all payers (they all contributed at paidDate)
    const contributionDates: Record<string, string> = {};
    selectedPayers.forEach((payerId) => {
      contributionDates[payerId] = paidDateISO;
    });

    // If only one payer and no credit used, use simple paidBy field
    if (selectedPayers.size === 1 && Object.keys(creditUsedMap).length === 0) {
      const payerId = Array.from(selectedPayers)[0];
      onConfirm(
        payerId,
        undefined,
        Object.keys(creditUsedMap).length > 0 ? creditUsedMap : undefined,
        uncoveredExcess > 0.01 ? { _totalOverpayment: uncoveredExcess } : undefined,
        coverageAllocations.length > 0 ? coverageAllocations : undefined,
        paidDateISO,
        contributionDates
      );
    } else {
      onConfirm(
        null,
        contributions,
        Object.keys(creditUsedMap).length > 0 ? creditUsedMap : undefined,
        uncoveredExcess > 0.01 ? { _totalOverpayment: uncoveredExcess } : undefined,
        coverageAllocations.length > 0 ? coverageAllocations : undefined,
        paidDateISO,
        contributionDates
      );
    }
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {existingPaidAmount > 0 ? 'Add another payment' : 'Who paid this bill?'}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            {bill.name} · <span className="font-semibold">${billAmount.toFixed(2)}</span>
            {existingPaidAmount > 0 && (
              <span className="text-blue-600 font-medium ml-2">
                (${remainingAmount.toFixed(2)} remaining)
              </span>
            )}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Member selection */}
          <div className="space-y-3">
            {members.map((member) => {
              const isSelected = selectedPayers.has(member.id);
              const hasCredit = (member.credit || 0) > 0;
              return (
                <div
                  key={member.id}
                  className={`p-3 rounded-xl border-2 transition-colors ${
                    isSelected ? 'border-slate-400 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`payer-${member.id}`}
                      checked={isSelected}
                      onCheckedChange={() => togglePayer(member.id)}
                    />
                    <label
                      htmlFor={`payer-${member.id}`}
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                    >
                      <MemberAvatar member={member} size="sm" />
                      <div>
                        <span className="font-medium">{member.name}</span>
                        {hasCredit && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                            ${(member.credit || 0).toFixed(2)} credit
                          </span>
                        )}
                      </div>
                    </label>
                    {isSelected && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={amounts[member.id] || ''}
                          onChange={(e) => handleAmountChange(member.id, e.target.value)}
                          placeholder="0.00"
                          className="w-24 text-right"
                        />
                      </div>
                    )}
                  </div>

                  {/* Credit application section */}
                  {isSelected && hasCredit && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-slate-600">Apply credit:</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={member.credit || 0}
                          value={creditToUse[member.id] || ''}
                          onChange={(e) => handleCreditChange(member.id, e.target.value)}
                          placeholder="0.00"
                          className="w-24 text-right text-sm h-8"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => useAllCredit(member.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 h-8 px-2"
                        >
                          Use all
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reset to even split button - only show if amounts were manually modified */}
          {selectedPayers.size > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={splitEvenly}
              className="w-full text-slate-500 hover:text-slate-700"
            >
              Reset to even split
            </Button>
          )}

          {/* Validation/status message */}
          {selectedPayers.size > 0 && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                isFullPayment
                  ? 'bg-emerald-50 text-emerald-700'
                  : isOverpayment
                  ? 'bg-violet-50 text-violet-700'
                  : isPartialPayment
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isOverpayment && <Plus className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {isFullPayment
                  ? existingPaidAmount > 0
                    ? 'This completes the payment'
                    : 'Total matches bill amount'
                  : isOverpayment
                  ? `$${overpaymentAmount.toFixed(2)} will be added as credit`
                  : isPartialPayment
                  ? `Partial payment · $${remaining.toFixed(2)} will remain unpaid`
                  : `Enter payment amounts`}
              </span>
            </div>
          )}

          {/* Credit usage summary */}
          {totalCreditUsed > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700">
              <Coins className="w-4 h-4" />
              <span className="text-sm font-medium">
                ${totalCreditUsed.toFixed(2)} credit applied
              </span>
            </div>
          )}

          {/* Coverage allocation section - show when payers are paying over their share */}
          {payersOverShare.length > 0 && membersNeedingCoverage.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Who is being covered?
              </p>
              {payersOverShare.map(({ payerId, excess }) => {
                const payer = members.find((m) => m.id === payerId);
                const coverageChoice = coveringFor[payerId];
                // Filter out payers who can't cover anyone (e.g., themselves)
                const coverableMembers = membersNeedingCoverage.filter((m) => m.id !== payerId);
                if (coverableMembers.length === 0) return null;

                // Determine display value (default to _cover_all when undefined)
                const displayValue = coverageChoice || '_cover_all';

                return (
                  <div key={payerId} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <MemberAvatar member={payer || { name: 'Unknown' }} size="sm" />
                        <span className="text-sm">
                          <span className="font-medium">{payer?.name}</span> is paying{' '}
                          <span className="font-semibold text-blue-600">${excess.toFixed(2)} extra</span>
                        </span>
                      </div>
                      <Select
                        value={displayValue}
                        onValueChange={(val) => handleCoverageChange(payerId, val)}
                      >
                        <SelectTrigger className="w-44 h-9 text-sm">
                          <SelectValue placeholder="Cover everyone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_cover_all">
                            <span className="flex items-center gap-2">
                              <Users className="w-3 h-3 text-blue-500" />
                              Cover everyone
                            </span>
                          </SelectItem>
                          {coverableMembers.map((m) => {
                            const theirShare = shares[m.id] || 0;
                            const theirPayment = selectedPayers.has(m.id)
                              ? parseFloat(amounts[m.id] || '0') + parseFloat(creditToUse[m.id] || '0')
                              : 0;
                            const shortfall = Math.max(0, theirShare - theirPayment);
                            return (
                              <SelectItem key={m.id} value={m.id}>
                                <span className="flex items-center gap-2">
                                  <MemberAvatar member={m} size="sm" />
                                  {m.name} only (${shortfall.toFixed(2)})
                                </span>
                              </SelectItem>
                            );
                          })}
                          <SelectItem value="_credit">
                            <span className="flex items-center gap-2">
                              <Coins className="w-3 h-3 text-emerald-500" />
                              Add as credit instead
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {displayValue === '_cover_all' && coverableMembers.length > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        {coverableMembers.map((m) => m.name).join(', ')} will owe {payer?.name}
                      </p>
                    )}
                    {displayValue !== '_cover_all' && displayValue !== '_credit' && (
                      <p className="text-xs text-slate-500 mt-2">
                        {members.find((m) => m.id === displayValue)?.name} will owe {payer?.name} for this
                      </p>
                    )}
                    {displayValue === '_credit' && (
                      <p className="text-xs text-emerald-600 mt-2">
                        ${excess.toFixed(2)} will be added to {payer?.name}'s credit
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paid Date Picker */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(paidDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={paidDate}
                  onSelect={(date) => date && setPaidDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            {isOverpayment
              ? 'Confirm & Add Credit'
              : isPartialPayment
              ? 'Record Partial Payment'
              : existingPaidAmount > 0 && isFullPayment
              ? 'Complete Payment'
              : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
