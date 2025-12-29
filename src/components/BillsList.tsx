import { useState } from 'react';
import type { Bill, Person } from '@/lib/types';
import { BILL_CATEGORIES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuSeparator,
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
import { MultiPayerDialog } from '@/components/MultiPayerDialog';
import { MoreVertical, Check, X, Pencil, Trash2 } from 'lucide-react';

interface BillsListProps {
  bills: Bill[];
  members: Person[];
  onEdit: (bill: Bill) => void;
  onDelete: (id: string) => Promise<void>;
  onMarkPaid: (id: string, paidBy: string | null, contributions?: Record<string, number>, billAmount?: number) => Promise<void>;
  onMarkUnpaid: (id: string) => Promise<void>;
}

export function BillsList({
  bills,
  members,
  onEdit,
  onDelete,
  onMarkPaid,
  onMarkUnpaid,
}: BillsListProps) {
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);

  const filteredBills = bills.filter((bill) => {
    if (filter === 'paid' && !bill.isPaid) return false;
    if (filter === 'unpaid' && bill.isPaid) return false;
    if (categoryFilter !== 'all' && bill.category !== categoryFilter) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryColor = (category: Bill['category']) => {
    const colors: Record<Bill['category'], string> = {
      mortgage: 'bg-slate-100 text-slate-700',
      utility: 'bg-sky-50 text-sky-700',
      insurance: 'bg-violet-50 text-violet-700',
      subscription: 'bg-amber-50 text-amber-700',
      groceries: 'bg-green-50 text-green-700',
      internet: 'bg-blue-50 text-blue-700',
      transportation: 'bg-orange-50 text-orange-700',
      medical: 'bg-rose-50 text-rose-700',
      other: 'bg-zinc-100 text-zinc-600',
    };
    return colors[category];
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bills</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {BILL_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm text-muted-foreground">
          {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filteredBills.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">No bills found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBills.map((bill) => (
            <div
              key={bill.id}
              className={`group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                bill.isPaid ? 'bg-muted/30' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${bill.isPaid ? 'line-through text-muted-foreground' : ''}`}>
                    {bill.name}
                  </span>
                  <Badge variant="secondary" className={getCategoryColor(bill.category)}>
                    {BILL_CATEGORIES.find((c) => c.value === bill.category)?.label}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <span>Due {formatDate(bill.dueDate)}</span>
                  <span>·</span>
                  <span className="capitalize">{bill.splitType} split</span>
                  {bill.isPaid && (bill.paidBy || bill.paidContributions) && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-600">
                        Paid by{' '}
                        {bill.paidContributions
                          ? Object.entries(bill.paidContributions)
                              .map(([id, amt]) => {
                                const name = members.find((m) => m.id === id)?.name || id;
                                return `${name} ($${amt.toFixed(2)})`;
                              })
                              .join(', ')
                          : members.find((m) => m.id === bill.paidBy)?.name}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="font-semibold tabular-nums">${bill.amount.toFixed(2)}</p>
                {bill.splitType === 'even' && members.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ${(bill.amount / members.length).toFixed(2)} each
                  </p>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!bill.isPaid ? (
                    <DropdownMenuItem onClick={() => setPayingBillId(bill.id)}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark as Paid
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onMarkUnpaid(bill.id)}>
                      <X className="mr-2 h-4 w-4" />
                      Mark as Unpaid
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit(bill)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteId(bill.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Pay Bill Dialog */}
      <MultiPayerDialog
        bill={bills.find((b) => b.id === payingBillId) || null}
        members={members}
        open={!!payingBillId}
        onOpenChange={(open) => !open && setPayingBillId(null)}
        onConfirm={async (paidBy, contributions) => {
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

            await onMarkPaid(payingBillId, paidBy, mergedContributions || contributions, bill.amount);
            setPayingBillId(null);
          }
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the bill record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
