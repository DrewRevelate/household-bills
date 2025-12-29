import { useMemo, useState } from 'react';
import type { Bill, Person, SettlementWithBreakdown, SettlementRecord } from '@/lib/types';
import { calculateBalances, calculateSettlementsWithBreakdown } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { MemberAvatar } from '@/components/MemberAvatar';
import { SettlementBreakdownDialog } from '@/components/SettlementBreakdownDialog';
import { ArrowRight, CheckCircle, CreditCard, MessageCircle, ChevronRight, PartyPopper, TrendingUp, TrendingDown, Gift, XCircle, Check, MoreHorizontal, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

// Venmo brand color
const VENMO_BLUE = '#008CFF';

interface SettlementsPageProps {
  bills: Bill[];
  members: Person[];
  settlementRecords?: SettlementRecord[];
  onForgiveDebt?: (fromId: string, toId: string, amount: number) => Promise<void>;
  onMarkSettlementPaid?: (fromId: string, toId: string, amount: number) => Promise<void>;
  onClearForgiveness?: () => Promise<void>;
}

export function SettlementsPage({ bills, members, settlementRecords = [], onForgiveDebt, onMarkSettlementPaid, onClearForgiveness }: SettlementsPageProps) {
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementWithBreakdown | null>(null);
  const [forgivingSettlement, setForgivingSettlement] = useState<SettlementWithBreakdown | null>(null);
  const [markingPaidSettlement, setMarkingPaidSettlement] = useState<SettlementWithBreakdown | null>(null);
  const [clearingForgiveness, setClearingForgiveness] = useState(false);
  const [venmoConfirmSettlement, setVenmoConfirmSettlement] = useState<SettlementWithBreakdown | null>(null);

  const balances = useMemo(() => calculateBalances(bills, members), [bills, members]);
  const settlements = useMemo(() => calculateSettlementsWithBreakdown(bills, members, settlementRecords), [bills, members, settlementRecords]);

  const totalOwed = useMemo(() => {
    return balances.reduce((sum, b) => (b.owes > 0 ? sum + b.owes : sum), 0);
  }, [balances]);

  const normalizeVenmoHandle = (handle?: string) => handle?.trim().replace(/^@/, '') || '';

  const getVenmoUrl = (settlement: SettlementWithBreakdown) => {
    const payee = members.find((m) => m.name === settlement.to);
    const venmoHandle = normalizeVenmoHandle(payee?.venmoHandle);
    const note = encodeURIComponent(`Household bills - ${settlement.from} to ${settlement.to}`);
    return venmoHandle
      ? `https://account.venmo.com/pay?recipients=${encodeURIComponent(venmoHandle)}&amount=${settlement.amount.toFixed(2)}&note=${note}`
      : `https://account.venmo.com/pay?amount=${settlement.amount.toFixed(2)}&note=${note}`;
  };

  const handleVenmoPayment = (settlement: SettlementWithBreakdown) => {
    const payee = members.find((m) => m.name === settlement.to);
    const venmoHandle = normalizeVenmoHandle(payee?.venmoHandle);

    if (!venmoHandle) {
      toast.info('Add a Venmo handle on the Members page to prefill the recipient.');
    }

    // Open Venmo
    window.open(getVenmoUrl(settlement), '_blank');

    // Show confirmation dialog
    setVenmoConfirmSettlement(settlement);
  };

  const handleVenmoConfirmed = async () => {
    if (!venmoConfirmSettlement || !onMarkSettlementPaid) return;
    const fromId = getMemberIdByName(venmoConfirmSettlement.from);
    const toId = getMemberIdByName(venmoConfirmSettlement.to);
    await onMarkSettlementPaid(fromId, toId, venmoConfirmSettlement.amount);
    setVenmoConfirmSettlement(null);
  };

  const getMemberByName = (name: string) => {
    return members.find((m) => m.name === name) || { name, avatarColor: undefined };
  };

  const getMemberIdByName = (name: string) => {
    return members.find((m) => m.name === name)?.id || '';
  };

  const handleForgive = async () => {
    if (!forgivingSettlement || !onForgiveDebt) return;
    const fromId = getMemberIdByName(forgivingSettlement.from);
    const toId = getMemberIdByName(forgivingSettlement.to);
    await onForgiveDebt(fromId, toId, forgivingSettlement.amount);
    setForgivingSettlement(null);
  };

  const handleMarkPaid = async () => {
    if (!markingPaidSettlement || !onMarkSettlementPaid) return;
    const fromId = getMemberIdByName(markingPaidSettlement.from);
    const toId = getMemberIdByName(markingPaidSettlement.to);
    await onMarkSettlementPaid(fromId, toId, markingPaidSettlement.amount);
    setMarkingPaidSettlement(null);
  };

  const handleClearForgiveness = async () => {
    if (!onClearForgiveness) return;
    await onClearForgiveness();
    setClearingForgiveness(false);
  };

  const totalForgiven = useMemo(() => {
    return settlementRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [settlementRecords]);

  const allSettled = settlements.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Dynamic Header */}
        <div className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            {allSettled ? "You're all square" : `$${totalOwed.toFixed(2)} to settle`}
          </h1>
          <p className="text-slate-500 text-lg mt-2">
            {allSettled
              ? 'No outstanding debts between family members'
              : `${settlements.length} payment${settlements.length !== 1 ? 's' : ''} needed`
            }
          </p>
        </div>

        {/* All Settled State */}
        {allSettled ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-10 sm:p-14 text-white text-center shadow-lg"
          >
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-5">
              <PartyPopper className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold">All Settled Up!</h2>
            <p className="text-emerald-100 text-xl mt-3">Everyone's even. Nice work keeping things balanced.</p>
          </motion.div>
        ) : (
          <>
            {/* Settlements List */}
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 mb-8">
              {settlements.map((settlement, index) => {
                const payee = members.find((m) => m.name === settlement.to);
                const payeeHandle = normalizeVenmoHandle(payee?.venmoHandle);

                return (
                  <motion.div
                    key={`${settlement.from}-${settlement.to}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Main row - clickable for details */}
                    <div
                      className="flex items-center gap-4 sm:gap-5 cursor-pointer"
                      onClick={() => setSelectedSettlement(settlement)}
                    >
                      {/* From → To */}
                      <div className="flex items-center gap-3 shrink-0">
                        <MemberAvatar member={getMemberByName(settlement.from)} size="md" />
                        <ArrowRight className="w-5 h-5 text-slate-300" />
                        <MemberAvatar member={getMemberByName(settlement.to)} size="md" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-xl">
                          {settlement.from} <span className="text-slate-400">owes</span> {settlement.to}
                        </p>
                        <p className="text-lg text-slate-500 mt-1">
                          {settlement.breakdown.length} bill{settlement.breakdown.length !== 1 ? 's' : ''} · Tap for details
                        </p>
                      </div>

                      {/* Amount */}
                      <p className="font-bold text-2xl sm:text-3xl text-slate-900 tabular-nums">
                        ${settlement.amount.toFixed(2)}
                      </p>

                      <ChevronRight className="w-6 h-6 text-slate-300" />
                    </div>

                    {/* Action buttons row */}
                    <div className="flex items-center gap-3 mt-4 ml-[88px]" onClick={(e) => e.stopPropagation()}>
                      {/* Primary Venmo Button */}
                      <Button
                        onClick={() => handleVenmoPayment(settlement)}
                        className="text-white font-semibold text-lg px-5 py-3 h-auto gap-2"
                        style={{ backgroundColor: VENMO_BLUE }}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.5 3c.9 1.5 1.3 3.1 1.3 5.1 0 5.7-4.9 13.1-8.8 18.3H5.1L2 4.2l6.5-.6 1.7 13.8c1.6-2.6 3.5-6.7 3.5-9.5 0-1.9-.3-3.2-.9-4.3L19.5 3z"/>
                        </svg>
                        {payeeHandle ? `Pay @${payeeHandle}` : 'Pay with Venmo'}
                        <ExternalLink className="w-4 h-4 opacity-60" />
                      </Button>

                      {/* More options dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-12 w-12">
                            <MoreHorizontal className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel className="text-base py-2">Other payment options</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-lg py-3"
                            onClick={() => {
                              const note = encodeURIComponent(`Household bills`);
                              window.open(`https://cash.app/$?amount=${settlement.amount.toFixed(2)}&note=${note}`, '_blank');
                            }}
                          >
                            <CreditCard className="w-5 h-5 mr-3 text-green-500" />
                            Cash App
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-lg py-3"
                            onClick={() => {
                              window.open(`https://www.paypal.com/paypalme/?amount=${settlement.amount.toFixed(2)}`, '_blank');
                            }}
                          >
                            <CreditCard className="w-5 h-5 mr-3 text-blue-700" />
                            PayPal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-lg py-3"
                            onClick={() => {
                              const body = encodeURIComponent(`Hey! I owe you $${settlement.amount.toFixed(2)} for household bills. Sending now!`);
                              window.open(`sms:&body=${body}`, '_blank');
                            }}
                          >
                            <MessageCircle className="w-5 h-5 mr-3 text-green-600" />
                            Send via iMessage
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {onMarkSettlementPaid && (
                            <DropdownMenuItem
                              className="text-lg py-3 text-emerald-600"
                              onClick={() => setMarkingPaidSettlement(settlement)}
                            >
                              <Check className="w-5 h-5 mr-3" />
                              Mark as paid (other method)
                            </DropdownMenuItem>
                          )}
                          {onForgiveDebt && (
                            <DropdownMenuItem
                              className="text-lg py-3 text-violet-600"
                              onClick={() => setForgivingSettlement(settlement)}
                            >
                              <Gift className="w-5 h-5 mr-3" />
                              Forgive this debt
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* Member Balances */}
        {members.length > 0 && (
          <div className="mt-10">
            <h2 className="text-base font-medium text-slate-500 uppercase tracking-wide mb-4">
              Individual Balances
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {balances.map((balance) => {
                const member = getMemberByName(balance.personName);
                const isOwed = balance.owes < -0.01;
                const owes = balance.owes > 0.01;
                const settled = !isOwed && !owes;

                return (
                  <div
                    key={balance.personId}
                    className={`p-5 rounded-xl border ${
                      settled
                        ? 'bg-slate-50 border-slate-200'
                        : isOwed
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <MemberAvatar member={member} size="md" />
                      <span className="font-semibold text-slate-900 truncate text-lg">
                        {balance.personName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwed && <TrendingUp className="w-5 h-5 text-emerald-600" />}
                      {owes && <TrendingDown className="w-5 h-5 text-red-600" />}
                      {settled && <CheckCircle className="w-5 h-5 text-slate-400" />}
                      <span className={`text-xl font-bold ${
                        settled
                          ? 'text-slate-500'
                          : isOwed
                            ? 'text-emerald-700'
                            : 'text-red-700'
                      }`}>
                        {settled
                          ? 'Even'
                          : isOwed
                            ? `+$${Math.abs(balance.owes).toFixed(2)}`
                            : `-$${Math.abs(balance.owes).toFixed(2)}`
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clear Forgiveness Records */}
        {settlementRecords.length > 0 && onClearForgiveness && (
          <div className="mt-10 pt-8 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setClearingForgiveness(true)}
              className="text-amber-600 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
            >
              <XCircle className="w-5 h-5 mr-2" />
              Clear all forgiveness records (${totalForgiven.toFixed(2)})
            </Button>
            <p className="text-sm text-slate-500 mt-2">
              This removes forgiveness history and restores original debt calculations.
            </p>
          </div>
        )}
      </div>

      <SettlementBreakdownDialog
        settlement={selectedSettlement}
        open={!!selectedSettlement}
        onOpenChange={(open) => !open && setSelectedSettlement(null)}
      />

      <AlertDialog open={!!forgivingSettlement} onOpenChange={(open) => !open && setForgivingSettlement(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-violet-500" />
              Forgive this debt?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {forgivingSettlement && (
                <>
                  <span className="font-semibold text-slate-900">{forgivingSettlement.to}</span> will forgive{' '}
                  <span className="font-semibold text-slate-900">${forgivingSettlement.amount.toFixed(2)}</span> owed by{' '}
                  <span className="font-semibold text-slate-900">{forgivingSettlement.from}</span>.
                  <br /><br />
                  This cannot be undone. The debt will be wiped away.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForgive}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Forgive Debt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!markingPaidSettlement} onOpenChange={(open) => !open && setMarkingPaidSettlement(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              Confirm Payment
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              {markingPaidSettlement && (
                <>
                  Confirm that <span className="font-semibold text-slate-900">{markingPaidSettlement.from}</span> has paid{' '}
                  <span className="font-semibold text-slate-900">${markingPaidSettlement.amount.toFixed(2)}</span> to{' '}
                  <span className="font-semibold text-slate-900">{markingPaidSettlement.to}</span>?
                  <br /><br />
                  This will clear the debt from the settlement list.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid} className="bg-emerald-600 hover:bg-emerald-700 text-lg px-6 py-3 h-auto">
              Confirm Paid
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearingForgiveness} onOpenChange={setClearingForgiveness}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl flex items-center gap-2">
              <XCircle className="w-6 h-6 text-amber-500" />
              Clear Forgiveness Records
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              Clear <span className="font-semibold text-slate-900">{settlementRecords.length}</span> forgiveness record{settlementRecords.length !== 1 ? 's' : ''} totaling{' '}
              <span className="font-semibold text-slate-900">${totalForgiven.toFixed(2)}</span>?
              <br /><br />
              This will restore all previously forgiven debts back to their original amounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearForgiveness} className="bg-amber-600 hover:bg-amber-700 text-lg px-6 py-3 h-auto">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Venmo Payment Confirmation Dialog */}
      <AlertDialog open={!!venmoConfirmSettlement} onOpenChange={(open) => !open && setVenmoConfirmSettlement(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl flex items-center gap-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill={VENMO_BLUE}>
                <path d="M19.5 3c.9 1.5 1.3 3.1 1.3 5.1 0 5.7-4.9 13.1-8.8 18.3H5.1L2 4.2l6.5-.6 1.7 13.8c1.6-2.6 3.5-6.7 3.5-9.5 0-1.9-.3-3.2-.9-4.3L19.5 3z"/>
              </svg>
              Venmo Payment Sent?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              {venmoConfirmSettlement && (
                <>
                  Did <span className="font-semibold text-slate-900">{venmoConfirmSettlement.from}</span> successfully send{' '}
                  <span className="font-semibold text-slate-900">${venmoConfirmSettlement.amount.toFixed(2)}</span> to{' '}
                  <span className="font-semibold text-slate-900">{venmoConfirmSettlement.to}</span> via Venmo?
                  <br /><br />
                  <span className="text-slate-500">Confirming will clear this debt from the settlement list.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3 flex-col sm:flex-row">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto">Not yet</AlertDialogCancel>
            {onMarkSettlementPaid && (
              <AlertDialogAction
                onClick={handleVenmoConfirmed}
                className="text-lg px-6 py-3 h-auto text-white"
                style={{ backgroundColor: VENMO_BLUE }}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Yes, payment sent!
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
