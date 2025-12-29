import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Bill, Person } from '@/lib/types';
import { getBillStatus } from '@/lib/types';
import { type TimeFrame, TIME_FRAME_OPTIONS, filterBillsByTimeFrame, getTimeFrameLabel } from '@/lib/timeframe';
import { calculateSettlements } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import { MemberAvatar } from '@/components/MemberAvatar';
import { MemberBillsCard } from '@/components/MemberBillsCard';
import { PayShareDialog } from '@/components/PayShareDialog';
import {
  Receipt,
  Plus,
  Users,
  AlertCircle,
  ArrowRight,
  Calendar,
  Repeat,
  CheckCircle2,
  PartyPopper,
  Clock,
} from 'lucide-react';
import { getCategoryIconComponent } from '@/components/CategoryIcon';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface DashboardProps {
  bills: Bill[];
  members: Person[];
  onAddBill?: () => void;
  onPayMemberShare?: (
    memberId: string,
    payments: { billId: string; amount: number }[]
  ) => void;
}


export function Dashboard({ bills, members, onAddBill, onPayMemberShare }: DashboardProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('this_month');
  const [payShareDialog, setPayShareDialog] = useState<{
    open: boolean;
    memberId: string;
    memberName: string;
    remaining: number;
  }>({ open: false, memberId: '', memberName: '', remaining: 0 });

  // Get current month/year for member bills
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const handlePayShare = (memberId: string, memberName: string, remaining: number) => {
    setPayShareDialog({ open: true, memberId, memberName, remaining });
  };

  const handlePayShareConfirm = (payments: { billId: string; amount: number }[]) => {
    if (onPayMemberShare) {
      onPayMemberShare(payShareDialog.memberId, payments);
    }
  };

  const filteredBills = useMemo(() => {
    return filterBillsByTimeFrame(bills, timeFrame);
  }, [bills, timeFrame]);

  const stats = useMemo(() => {
    const totalAmount = filteredBills.reduce((sum, b) => sum + b.amount, 0);
    const paidBills = filteredBills.filter((b) => b.isPaid);
    const paidAmount = paidBills.reduce((sum, b) => sum + b.amount, 0);
    const pendingBills = filteredBills.filter((b) => !b.isPaid);
    const pendingAmount = pendingBills.reduce((sum, b) => sum + b.amount, 0);
    const paidPercentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

    return { totalAmount, paidAmount, paidCount: paidBills.length, pendingCount: pendingBills.length, pendingAmount, memberCount: members.length, billCount: filteredBills.length, paidPercentage };
  }, [filteredBills, members]);

  const settlements = useMemo(() => calculateSettlements(bills, members), [bills, members]);
  const totalSettlementAmount = settlements.reduce((sum, s) => sum + s.amount, 0);

  const upcomingBills = useMemo(() => {
    const now = new Date();
    return bills
      .filter((b) => !b.isPaid && new Date(b.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [bills]);

  const overdueBills = useMemo(() => {
    return bills.filter((b) => getBillStatus(b) === 'overdue');
  }, [bills]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const CategoryIconForBill = ({ category }: { category: string }) => {
    const IconComponent = getCategoryIconComponent(category);
    return <IconComponent className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: '#64748b' }} />;
  };

  const allPaid = stats.pendingCount === 0 && stats.billCount > 0;
  const almostDone = stats.paidPercentage >= 80 && !allPaid;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* Greeting + Time Filter */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 sm:mb-14">
          <div>
            <p className="text-slate-500 text-lg sm:text-xl font-medium">{getGreeting()}</p>
            <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent mt-2">
              {allPaid ? "You're all caught up!" : `${stats.pendingCount} bill${stats.pendingCount !== 1 ? 's' : ''} to go`}
            </h1>
          </div>
          <Select value={timeFrame} onValueChange={(v) => setTimeFrame(v as TimeFrame)}>
            <SelectTrigger className="w-fit gap-3 py-3 px-5 text-lg font-medium rounded-full border border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white hover:shadow-md transition-all min-h-[52px]">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FRAME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-lg py-3">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 sm:mb-14"
        >
          {allPaid ? (
            <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-white shadow-xl shadow-emerald-500/20">
              <div className="flex items-center gap-5">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <PartyPopper className="w-10 h-10 sm:w-11 sm:h-11" />
                </div>
                <div>
                  <p className="text-emerald-100 text-lg sm:text-xl font-medium">All bills paid for {getTimeFrameLabel(timeFrame).toLowerCase()}</p>
                  <p className="text-4xl sm:text-6xl font-bold mt-2">${stats.paidAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-8 sm:p-10 card-shadow border border-slate-200/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <p className="text-slate-500 text-lg sm:text-xl font-medium">Still owed for {getTimeFrameLabel(timeFrame).toLowerCase()}</p>
                  <p className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mt-2 tabular-nums">
                    ${stats.pendingAmount.toFixed(2)}
                  </p>
                  {almostDone && (
                    <p className="text-emerald-600 text-lg font-medium mt-3 flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6" />
                      Almost there! {stats.paidPercentage}% done
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-4">
                  <div className="text-right">
                    <p className="text-sm text-slate-400 uppercase tracking-wide font-medium">Progress</p>
                    <p className="text-2xl font-bold text-slate-700">{stats.paidCount} of {stats.billCount} paid</p>
                  </div>
                  <div className="w-full sm:w-56 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.paidPercentage}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Overdue Alert */}
        {overdueBills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 sm:mb-10 bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <AlertCircle className="w-7 h-7 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-800 text-lg sm:text-xl">
                  {overdueBills.length} overdue {overdueBills.length === 1 ? 'bill needs' : 'bills need'} attention
                </p>
                <p className="text-base text-red-600 mt-1">
                  ${overdueBills.reduce((s, b) => s + b.amount, 0).toFixed(2)} past due
                </p>
              </div>
              <Link to="/bills">
                <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100 text-lg px-6 py-3 h-auto">
                  View
                </Button>
              </Link>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 sm:gap-10">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">

            {/* Upcoming Bills */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Coming Up</h2>
                <Link to="/bills" className="text-lg font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2 py-2">
                  All bills <ArrowRight className="w-5 h-5" />
                </Link>
              </div>

              {upcomingBills.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBills.map((bill, index) => (
                    <motion.div
                      key={bill.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-5 p-5 sm:p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/50 hover:bg-white hover:shadow-md hover:border-slate-200 transition-all duration-200 group"
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shrink-0 group-hover:from-indigo-50 group-hover:to-violet-50 transition-all">
                        <CategoryIconForBill category={bill.category} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-xl truncate">{bill.name}</p>
                        <p className="text-base text-slate-500 flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(bill.dueDate)}
                          {bill.recurring && (
                            <span className="ml-2 text-slate-400 flex items-center gap-1">
                              <Repeat className="w-4 h-4" />
                              {bill.frequency}
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="font-bold text-slate-900 text-2xl tabular-nums">${bill.amount.toFixed(2)}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-dashed border-slate-300 p-10 text-center">
                  <Receipt className="w-14 h-14 mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-600 font-medium text-xl">No upcoming bills</p>
                  <p className="text-lg text-slate-400 mt-2">You're ahead of the game</p>
                </div>
              )}
            </div>

            {/* Quick Add */}
            {onAddBill && (
              <Button
                onClick={onAddBill}
                variant="outline"
                className="w-full py-8 border-dashed border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 rounded-xl font-medium text-xl"
              >
                <Plus className="w-6 h-6 mr-3" />
                Add a new bill
              </Button>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-8">

            {/* Member Bills */}
            <MemberBillsCard
              bills={bills}
              members={members}
              month={currentMonth}
              year={currentYear}
              onPayShare={onPayMemberShare ? handlePayShare : undefined}
            />

            {/* Settlements Quick View */}
            {settlements.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-slate-900/20">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-xl">Settle Up</h3>
                  <Link to="/settlements" className="text-lg text-slate-400 hover:text-white py-2 transition-colors">
                    Details
                  </Link>
                </div>
                <p className="text-4xl font-bold">${totalSettlementAmount.toFixed(2)}</p>
                <p className="text-slate-400 text-lg mt-2">
                  {settlements.length} payment{settlements.length !== 1 ? 's' : ''} between members
                </p>
              </div>
            )}

            {/* Family */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/50 p-6 card-shadow">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-slate-900 text-xl">Family</h3>
                <Link to="/members" className="text-lg text-slate-500 hover:text-indigo-600 py-2 transition-colors">
                  Manage
                </Link>
              </div>

              {members.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {members.map((member) => (
                    <MemberAvatar key={member.id} member={member} size="md" showName />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-lg text-slate-500">Add family members</p>
                  <Link to="/members">
                    <Button className="mt-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-lg px-6 py-3 h-auto shadow-lg shadow-indigo-500/25">
                      <Plus className="w-5 h-5 mr-2" />
                      Add
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Month Summary */}
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-200/50 card-shadow">
              <h3 className="text-base font-medium text-slate-500 uppercase tracking-wide mb-4">
                {getTimeFrameLabel(timeFrame)}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="text-slate-600">Total</span>
                  <span className="font-semibold text-slate-900">${stats.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-slate-600">Paid</span>
                  <span className="font-semibold text-emerald-600">${stats.paidAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between text-lg">
                  <span className="text-slate-600">Remaining</span>
                  <span className="font-bold text-slate-900 text-xl">${stats.pendingAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pay Share Dialog */}
      <PayShareDialog
        open={payShareDialog.open}
        onOpenChange={(open) => setPayShareDialog((prev) => ({ ...prev, open }))}
        member={members.find((m) => m.id === payShareDialog.memberId) || null}
        bills={bills}
        members={members}
        totalRemaining={payShareDialog.remaining}
        onPayShare={handlePayShareConfirm}
      />
    </div>
  );
}
