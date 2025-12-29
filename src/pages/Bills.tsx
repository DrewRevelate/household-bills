import { useState, useMemo } from 'react';
import type { Bill, Person, CoverageAllocation } from '@/lib/types';
import { BILL_CATEGORIES } from '@/lib/types';
import { type TimeFrame, TIME_FRAME_OPTIONS, filterBillsByTimeFrame, getTimeFrameLabel } from '@/lib/timeframe';
import { calculateBillShares } from '@/lib/hooks';
import { BillForm } from '@/components/BillForm';
import { MultiPayerDialog } from '@/components/MultiPayerDialog';
import { PaymentBreakdownDialog } from '@/components/PaymentBreakdownDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Plus, Search, Calendar, CheckCircle, Clock, AlertCircle, MoreHorizontal, Trash2, Pencil, Repeat, X, CheckSquare, XCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getCategoryIconComponent } from '@/components/CategoryIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface RecurrenceOptions {
  endType: 'after' | 'on_date';
  count?: number;
  endDate?: string;
}

interface BillsPageProps {
  bills: Bill[];
  members: Person[];
  onAddBill: (bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>, recurrenceOptions?: RecurrenceOptions) => Promise<void>;
  onUpdateBill: (id: string, bill: Partial<Bill>) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  onMarkPaid: (id: string, paidBy: string | null, contributions?: Record<string, number>, billAmount?: number, coverageAllocations?: CoverageAllocation[], creditUsed?: Record<string, number>, creditEarned?: Record<string, number>, paidDate?: string, contributionDates?: Record<string, string>) => Promise<void>;
  onMarkUnpaid: (id: string) => Promise<void>;
  onAddCredit?: (memberId: string, amount: number) => Promise<void>;
  onUseCredit?: (memberId: string, amount: number) => Promise<void>;
  onDeleteOldBills?: (cutoffDate: string) => Promise<number>;
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'partial';

const CategoryIconForBill = ({ category }: { category: string }) => {
  const IconComponent = getCategoryIconComponent(category);
  return <IconComponent className="w-7 h-7" style={{ color: '#64748b' }} />;
};

export function BillsPage({
  bills,
  members,
  onAddBill,
  onUpdateBill,
  onDeleteBill,
  onMarkPaid,
  onMarkUnpaid,
  onAddCredit,
  onUseCredit,
  onDeleteOldBills,
}: BillsPageProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('this_month');
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [viewingBreakdownBillId, setViewingBreakdownBillId] = useState<string | null>(null);
  const [deletingOldBills, setDeletingOldBills] = useState(false);
  // Mass update state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'delete' | 'category' | null>(null);
  const [bulkCategory, setBulkCategory] = useState<string>('other');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Selection helpers
  const toggleBillSelection = (billId: string) => {
    setSelectedBills((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) {
        next.delete(billId);
      } else {
        next.add(billId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedBills(new Set(filteredBills.map((b) => b.id)));
  };

  const clearSelection = () => {
    setSelectedBills(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedBills(new Set());
    setBulkAction(null);
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    try {
      for (const billId of selectedBills) {
        await onDeleteBill(billId);
      }
      exitSelectionMode();
    } finally {
      setBulkProcessing(false);
      setBulkAction(null);
    }
  };

  const handleBulkCategoryChange = async () => {
    setBulkProcessing(true);
    try {
      for (const billId of selectedBills) {
        await onUpdateBill(billId, { category: bulkCategory as Bill['category'] });
      }
      exitSelectionMode();
    } finally {
      setBulkProcessing(false);
      setBulkAction(null);
    }
  };

  const timeFilteredBills = useMemo(() => {
    return filterBillsByTimeFrame(bills, timeFrame);
  }, [bills, timeFrame]);

  const getBillStatus = (bill: Bill): 'paid' | 'pending' | 'overdue' | 'partial' => {
    if (bill.isPaid) return 'paid';

    // Check for partial payment
    if (bill.paidContributions) {
      const totalPaid = Object.values(bill.paidContributions).reduce((sum, amt) => sum + amt, 0);
      if (totalPaid > 0 && totalPaid < bill.amount) {
        return 'partial';
      }
    }

    const isOverdue = new Date(bill.dueDate) < new Date();
    return isOverdue ? 'overdue' : 'pending';
  };

  const statusCounts = useMemo(() => {
    const counts = { all: 0, pending: 0, paid: 0, overdue: 0, partial: 0 };
    timeFilteredBills.forEach((bill) => {
      counts.all++;
      const status = getBillStatus(bill);
      counts[status]++;
    });
    return counts;
  }, [timeFilteredBills]);

  const filteredBills = useMemo(() => {
    return timeFilteredBills.filter((bill) => {
      if (searchQuery && !bill.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all') {
        const status = getBillStatus(bill);
        if (status !== statusFilter) return false;
      }
      if (categoryFilter !== 'all' && bill.category !== categoryFilter) return false;
      return true;
    });
  }, [timeFilteredBills, searchQuery, statusFilter, categoryFilter]);

  // Count bills before September 2025 for cleanup
  const oldBillsCount = useMemo(() => {
    return bills.filter((bill) => bill.dueDate < '2025-09-01').length;
  }, [bills]);

  const handleDeleteOldBills = async () => {
    if (!onDeleteOldBills) return;
    await onDeleteOldBills('2025-09-01');
    setDeletingOldBills(false);
  };

  const openAddForm = () => {
    setEditingBill(undefined);
    setFormOpen(true);
  };

  const openEditForm = (bill: Bill) => {
    setEditingBill(bill);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingBill(undefined);
  };

  const handleSubmit = async (bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>, recurrenceOptions?: RecurrenceOptions) => {
    if (editingBill) {
      await onUpdateBill(editingBill.id, bill);
    } else {
      await onAddBill(bill, recurrenceOptions);
    }
  };

  const formatDate = (dateStr: string) => {
    // Handle both "YYYY-MM-DD" and ISO timestamp "YYYY-MM-DDTHH:mm:ss.sssZ" formats
    let date: Date;
    if (dateStr.includes('T')) {
      // Full ISO timestamp - parse directly
      date = new Date(dateStr);
    } else {
      // Simple date string - parse components to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }

    // Validate the date
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIndicator = (bill: Bill) => {
    const status = getBillStatus(bill);
    if (status === 'paid') {
      return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    }
    if (status === 'partial') {
      return <Clock className="w-5 h-5 text-blue-500" />;
    }
    if (status === 'overdue') {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    return <Clock className="w-5 h-5 text-slate-400" />;
  };

  const getHeaderText = () => {
    if (statusFilter === 'overdue' && statusCounts.overdue > 0) {
      return `${statusCounts.overdue} overdue`;
    }
    if (statusFilter === 'pending') {
      return `${statusCounts.pending} pending`;
    }
    if (statusFilter === 'partial') {
      return `${statusCounts.partial} partial`;
    }
    if (statusFilter === 'paid') {
      return `${statusCounts.paid} paid`;
    }
    return `${statusCounts.all} bills`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              {selectionMode ? `${selectedBills.size} selected` : getHeaderText()}
            </h1>
            <p className="text-slate-500 text-lg mt-2">
              {selectionMode ? (
                <button onClick={exitSelectionMode} className="text-slate-600 hover:text-slate-900">
                  Tap to exit selection mode
                </button>
              ) : (
                <>
                  {getTimeFrameLabel(timeFrame)}
                  {categoryFilter !== 'all' && ` · ${BILL_CATEGORIES.find(c => c.value === categoryFilter)?.label}`}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            {selectionMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={selectAllVisible}
                  className="text-lg px-5 py-3 h-auto"
                >
                  <CheckSquare className="w-5 h-5 mr-2" />
                  Select all
                </Button>
                <Button
                  variant="outline"
                  onClick={exitSelectionMode}
                  className="text-lg px-5 py-3 h-auto"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {filteredBills.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setSelectionMode(true)}
                    className="text-lg px-5 py-3 h-auto"
                  >
                    <CheckSquare className="w-5 h-5 mr-2" />
                    Select
                  </Button>
                )}
                <Button
                  onClick={openAddForm}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm text-lg px-6 py-3 h-auto"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add bill
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl mb-8 w-fit">
          {(['all', 'pending', 'partial', 'overdue', 'paid'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-5 py-3 text-lg font-medium rounded-lg transition-colors min-h-[52px] ${
                statusFilter === status
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {statusCounts[status] > 0 && (
                <span className={`ml-2 ${statusFilter === status ? 'text-slate-500' : 'text-slate-400'}`}>
                  {statusCounts[status]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search bills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-white border-slate-200 text-lg h-14"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <Select value={timeFrame} onValueChange={(v) => setTimeFrame(v as TimeFrame)}>
              <SelectTrigger className="w-[160px] bg-white border-slate-200 text-lg h-14">
                <Calendar className="w-5 h-5 mr-2 text-slate-400" />
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] bg-white border-slate-200 text-lg h-14">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-lg py-3">All categories</SelectItem>
                {BILL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-lg py-3">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bills List */}
        {filteredBills.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            <AnimatePresence>
              {filteredBills.map((bill, index) => {
                const status = getBillStatus(bill);

                const hasPaidContributions = bill.paidContributions || bill.paidBy;
                const isClickable = (status === 'paid' || status === 'partial') && hasPaidContributions;

                return (
                  <motion.div
                    key={bill.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`flex items-center gap-5 p-5 sm:p-6 hover:bg-slate-50 transition-colors group ${
                      status === 'paid' ? 'opacity-60' : ''
                    } ${selectionMode ? 'cursor-pointer' : isClickable ? 'cursor-pointer' : ''} ${
                      selectedBills.has(bill.id) ? 'bg-blue-50 hover:bg-blue-100' : ''
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        toggleBillSelection(bill.id);
                      } else if (isClickable) {
                        setViewingBreakdownBillId(bill.id);
                      }
                    }}
                  >
                    {/* Checkbox (selection mode) */}
                    {selectionMode && (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedBills.has(bill.id)}
                          onCheckedChange={() => toggleBillSelection(bill.id)}
                          className="w-6 h-6 border-2"
                        />
                      </div>
                    )}

                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <CategoryIconForBill category={bill.category} />
                    </div>

                    {/* Bill Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className={`font-semibold text-slate-900 text-xl truncate ${status === 'paid' ? 'line-through' : ''}`}>
                          {bill.name}
                        </p>
                        {bill.recurring && (
                          <Repeat className="w-5 h-5 text-slate-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {getStatusIndicator(bill)}
                        <span className={`text-lg ${
                          status === 'overdue' ? 'text-red-600 font-medium' :
                          status === 'partial' ? 'text-blue-600 font-medium' :
                          'text-slate-500'
                        }`}>
                          {status === 'paid' ? (
                            <>
                              Due {formatDate(bill.dueDate)}
                              {bill.paidDate && (
                                <span className="text-emerald-600"> • Paid {formatDate(bill.paidDate)}</span>
                              )}
                            </>
                          ) :
                           status === 'partial' ? (() => {
                             const totalPaid = bill.paidContributions
                               ? Object.values(bill.paidContributions).reduce((sum, amt) => sum + amt, 0)
                               : 0;
                             const remaining = bill.amount - totalPaid;
                             return `$${remaining.toFixed(2)} remaining`;
                           })() :
                           formatDate(bill.dueDate)}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-lg text-slate-400">
                          {BILL_CATEGORIES.find(c => c.value === bill.category)?.label}
                        </span>
                        {isClickable && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-lg text-slate-400 group-hover:text-slate-600">
                              Tap for details
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <p className="font-bold text-slate-900 text-2xl tabular-nums">
                      ${bill.amount.toFixed(2)}
                    </p>

                    {/* Actions */}
                    {!selectionMode && (
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {!bill.isPaid && (
                          <Button
                            onClick={() => setPayingBillId(bill.id)}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-lg px-6 py-3 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {status === 'partial' ? 'Add Payment' : 'Pay'}
                          </Button>
                        )}
                        {(bill.isPaid || status === 'partial') && (
                          <Button
                            variant="ghost"
                            onClick={() => onMarkUnpaid(bill.id)}
                            className="text-slate-500 text-lg px-6 py-3 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {status === 'partial' ? 'Clear' : 'Undo'}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-12 w-12 text-slate-400 hover:text-slate-600">
                              <MoreHorizontal className="w-6 h-6" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditForm(bill)} className="text-lg py-3">
                              <Pencil className="w-5 h-5 mr-3" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteBill(bill.id)}
                              className="text-red-600 text-lg py-3"
                            >
                              <Trash2 className="w-5 h-5 mr-3" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-14 text-center">
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
              {searchQuery ? (
                <Search className="w-8 h-8 text-slate-400" />
              ) : (
                <Clock className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <h3 className="font-semibold text-slate-900 text-xl">
              {searchQuery ? 'No matches found' : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}bills`}
            </h3>
            <p className="text-lg text-slate-500 mt-2">
              {searchQuery
                ? 'Try a different search term'
                : statusFilter === 'all'
                ? 'Add your first bill to get started'
                : `No ${statusFilter} bills for ${getTimeFrameLabel(timeFrame).toLowerCase()}`}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button
                onClick={openAddForm}
                className="mt-6 bg-slate-900 hover:bg-slate-800 text-white text-lg px-8 py-4 h-auto"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add bill
              </Button>
            )}
          </div>
        )}

        {/* Quick Add */}
        {filteredBills.length > 0 && (
          <Button
            onClick={openAddForm}
            variant="outline"
            className="w-full mt-6 py-8 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 text-xl"
          >
            <Plus className="w-6 h-6 mr-3" />
            Add another bill
          </Button>
        )}

        {/* Delete Old Bills */}
        {oldBillsCount > 0 && onDeleteOldBills && !selectionMode && (
          <div className="mt-10 pt-8 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setDeletingOldBills(true)}
              className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Delete {oldBillsCount} old bill{oldBillsCount !== 1 ? 's' : ''} (before Sep 2025)
            </Button>
            <p className="text-sm text-slate-500 mt-2">
              Permanently remove bills with due dates before September 1, 2025.
            </p>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectionMode && selectedBills.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50"
          >
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-lg font-medium text-slate-900">
                  {selectedBills.size} bill{selectedBills.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="text-slate-500 hover:text-slate-700 text-lg"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger className="w-[160px] text-lg h-12">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="text-lg py-2">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setBulkAction('category')}
                  className="text-lg px-5 py-3 h-auto"
                >
                  Change category
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBulkAction('delete')}
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 text-lg px-5 py-3 h-auto"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pay Bill Dialog */}
      <MultiPayerDialog
        bill={bills.find((b) => b.id === payingBillId) || null}
        members={members}
        open={!!payingBillId}
        onOpenChange={(open) => !open && setPayingBillId(null)}
        onConfirm={async (paidBy, contributions, creditUsed, overpaymentInfo, coverageAllocations, paidDate, contributionDates) => {
          const bill = bills.find((b) => b.id === payingBillId);
          if (payingBillId && bill) {
            // Merge with existing partial payment contributions
            const existingContributions = bill.paidContributions || {};
            const mergedContributions = contributions
              ? { ...existingContributions }
              : undefined;

            if (contributions && mergedContributions) {
              Object.entries(contributions).forEach(([personId, amount]) => {
                mergedContributions[personId] = (mergedContributions[personId] || 0) + amount;
              });
            }

            // Merge contribution dates with existing ones
            const existingContributionDates = bill.contributionDates || {};
            const mergedContributionDates = contributionDates
              ? { ...existingContributionDates, ...contributionDates }
              : Object.keys(existingContributionDates).length > 0 ? existingContributionDates : undefined;

            // Merge coverage allocations with existing ones
            const existingCoverage = bill.coverageAllocations || [];
            const mergedCoverage = coverageAllocations
              ? [...existingCoverage, ...coverageAllocations]
              : existingCoverage.length > 0 ? existingCoverage : undefined;

            // Merge credit usage with existing
            const existingCreditUsed = bill.creditUsed || {};
            const mergedCreditUsed = creditUsed
              ? { ...existingCreditUsed }
              : Object.keys(existingCreditUsed).length > 0 ? existingCreditUsed : undefined;

            if (creditUsed && mergedCreditUsed) {
              Object.entries(creditUsed).forEach(([personId, amount]) => {
                mergedCreditUsed[personId] = (mergedCreditUsed[personId] || 0) + amount;
              });
            }

            // Handle credit usage - deduct from member's credit
            if (creditUsed && onUseCredit) {
              for (const [personId, amount] of Object.entries(creditUsed)) {
                await onUseCredit(personId, amount);
              }
            }

            // Handle overpayments - only add credit for excess NOT assigned as coverage
            // Credit goes to whoever paid MORE than their share AND didn't assign coverage
            // Also track creditEarned so we can reverse it if payment is deleted
            const existingCreditEarned = bill.creditEarned || {};
            let mergedCreditEarned: Record<string, number> | undefined =
              Object.keys(existingCreditEarned).length > 0 ? { ...existingCreditEarned } : undefined;

            if (overpaymentInfo && overpaymentInfo._totalOverpayment > 0 && onAddCredit) {
              const shares = calculateBillShares(bill, members);
              const finalContributions = mergedContributions || (paidBy ? { [paidBy]: bill.amount } : {});

              // Calculate coverage amounts per payer
              const coveragePerPayer: Record<string, number> = {};
              if (coverageAllocations) {
                coverageAllocations.forEach((c) => {
                  coveragePerPayer[c.payerId] = (coveragePerPayer[c.payerId] || 0) + c.amount;
                });
              }

              // For each person who contributed, check if they paid more than their share
              for (const [personId, amountPaid] of Object.entries(finalContributions)) {
                const theirShare = shares[personId] || 0;
                const excess = amountPaid - theirShare;
                // Subtract any amount they're covering for others
                const coveringAmount = coveragePerPayer[personId] || 0;
                const actualOverpayment = excess - coveringAmount;
                if (actualOverpayment > 0.01) {
                  const creditAmount = Math.round(actualOverpayment * 100) / 100;
                  await onAddCredit(personId, creditAmount);
                  // Track credit earned for this payment
                  if (!mergedCreditEarned) mergedCreditEarned = {};
                  mergedCreditEarned[personId] = (mergedCreditEarned[personId] || 0) + creditAmount;
                }
              }
            }

            await onMarkPaid(payingBillId, paidBy, mergedContributions || contributions, bill.amount, mergedCoverage, mergedCreditUsed, mergedCreditEarned, paidDate, mergedContributionDates);
            setPayingBillId(null);
          }
        }}
      />

      {/* Bill Form Modal */}
      <BillForm
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleSubmit}
        initialData={editingBill}
        members={members}
      />

      {/* Payment Breakdown Dialog */}
      <PaymentBreakdownDialog
        bill={bills.find((b) => b.id === viewingBreakdownBillId) || null}
        members={members}
        open={!!viewingBreakdownBillId}
        onOpenChange={(open) => !open && setViewingBreakdownBillId(null)}
        onUpdatePayment={async (billId, personId, newAmount) => {
          const bill = bills.find((b) => b.id === billId);
          if (!bill) return;

          // Convert legacy paidBy to paidContributions if needed
          let updatedContributions: Record<string, number>;
          if (bill.paidContributions) {
            updatedContributions = { ...bill.paidContributions };
          } else if (bill.paidBy) {
            // Legacy single-payer - convert to contributions
            updatedContributions = { [bill.paidBy]: bill.amount };
          } else {
            updatedContributions = {};
          }

          if (newAmount === 0) {
            delete updatedContributions[personId];
          } else {
            updatedContributions[personId] = newAmount;
          }

          // Calculate new total
          const newTotal = Object.values(updatedContributions).reduce((sum, amt) => sum + amt, 0);
          const isFullyPaid = newTotal >= bill.amount - 0.01;

          // If no contributions left, clear everything
          if (Object.keys(updatedContributions).length === 0) {
            await onUpdateBill(billId, {
              isPaid: false,
              paidBy: null,
              paidContributions: undefined,
              paidDate: null,
            });
            setViewingBreakdownBillId(null);
          } else {
            await onUpdateBill(billId, {
              isPaid: isFullyPaid,
              paidBy: null, // Clear legacy paidBy
              paidContributions: updatedContributions,
            });
          }
        }}
        onDeletePayment={async (billId, personId) => {
          const bill = bills.find((b) => b.id === billId);
          if (!bill) return;

          // If this person earned credit from overpaying, remove it
          if (bill.creditEarned?.[personId] && onUseCredit) {
            await onUseCredit(personId, bill.creditEarned[personId]);
          }

          // Update creditEarned to remove this person's entry
          let updatedCreditEarned: Record<string, number> | undefined;
          if (bill.creditEarned) {
            updatedCreditEarned = { ...bill.creditEarned };
            delete updatedCreditEarned[personId];
            if (Object.keys(updatedCreditEarned).length === 0) {
              updatedCreditEarned = undefined;
            }
          }

          // Convert legacy paidBy to paidContributions if needed
          let updatedContributions: Record<string, number>;
          if (bill.paidContributions) {
            updatedContributions = { ...bill.paidContributions };
          } else if (bill.paidBy) {
            // Legacy single-payer - convert to contributions then delete
            updatedContributions = { [bill.paidBy]: bill.amount };
          } else {
            updatedContributions = {};
          }

          delete updatedContributions[personId];

          // Calculate new total
          const newTotal = Object.values(updatedContributions).reduce((sum, amt) => sum + amt, 0);
          const isFullyPaid = newTotal >= bill.amount - 0.01;

          // If no contributions left, clear everything
          if (Object.keys(updatedContributions).length === 0) {
            await onUpdateBill(billId, {
              isPaid: false,
              paidBy: null,
              paidContributions: undefined,
              creditEarned: undefined,
              paidDate: null,
            });
            setViewingBreakdownBillId(null);
          } else {
            await onUpdateBill(billId, {
              isPaid: isFullyPaid,
              paidBy: null, // Clear legacy paidBy
              paidContributions: updatedContributions,
              creditEarned: updatedCreditEarned,
            });
          }
        }}
        onUpdatePaidDate={async (billId, paidDate) => {
          await onUpdateBill(billId, { paidDate });
        }}
        onUpdateContributionDate={async (billId, personId, date) => {
          const bill = bills.find((b) => b.id === billId);
          if (!bill) return;
          const updatedDates = { ...(bill.contributionDates || {}), [personId]: date };
          await onUpdateBill(billId, { contributionDates: updatedDates });
        }}
      />

      {/* Delete Old Bills Confirmation */}
      <AlertDialog open={deletingOldBills} onOpenChange={setDeletingOldBills}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" />
              Delete Old Bills
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              Permanently delete <span className="font-semibold text-slate-900">{oldBillsCount}</span> bill{oldBillsCount !== 1 ? 's' : ''} with due dates before September 1, 2025?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOldBills} className="bg-red-600 hover:bg-red-700 text-lg px-6 py-3 h-auto">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkAction === 'delete'} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-red-500" />
              Delete {selectedBills.size} Bill{selectedBills.size !== 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              Permanently delete the selected bill{selectedBills.size !== 1 ? 's' : ''}?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto" disabled={bulkProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-lg px-6 py-3 h-auto"
              disabled={bulkProcessing}
            >
              {bulkProcessing ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Category Change Confirmation */}
      <AlertDialog open={bulkAction === 'category'} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">
              Change Category
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              Change category to <span className="font-semibold text-slate-900">{BILL_CATEGORIES.find(c => c.value === bulkCategory)?.label}</span> for {selectedBills.size} bill{selectedBills.size !== 1 ? 's' : ''}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto" disabled={bulkProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkCategoryChange}
              className="bg-slate-900 hover:bg-slate-800 text-lg px-6 py-3 h-auto"
              disabled={bulkProcessing}
            >
              {bulkProcessing ? 'Updating...' : 'Change Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
