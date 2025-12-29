import { useState, useEffect } from 'react';
import type { Bill, Person, BillFrequency, ReceiptItem } from '@/lib/types';
import { BILL_CATEGORIES, BILL_FREQUENCIES } from '@/lib/types';
import { ReceiptItemsEditor } from '@/components/ReceiptItemsEditor';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface RecurrenceOptions {
  endType: 'after' | 'on_date';
  count?: number;
  endDate?: string;
}

interface BillFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>, recurrenceOptions?: RecurrenceOptions) => Promise<void>;
  initialData?: Bill;
  members: Person[];
}

type RecurrenceEndType = 'after' | 'on_date';

export function BillForm({ open, onClose, onSubmit, initialData, members }: BillFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState<Bill['category']>('utility');
  const [splitType, setSplitType] = useState<Bill['splitType']>('even');
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<BillFrequency>('monthly');
  const [recurrenceEndType, setRecurrenceEndType] = useState<RecurrenceEndType>('after');
  const [recurrenceCount, setRecurrenceCount] = useState('12');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setAmount(initialData.amount.toString());
      setDueDate(initialData.dueDate);
      setCategory(initialData.category);
      setSplitType(initialData.splitType);
      setRecurring(initialData.recurring || false);
      setFrequency(initialData.frequency || 'monthly');
      setNotes(initialData.notes || '');
      if (initialData.customSplits) {
        const splits: Record<string, string> = {};
        Object.entries(initialData.customSplits).forEach(([k, v]) => {
          splits[k] = v.toString();
        });
        setCustomSplits(splits);
      }
      if (initialData.items) {
        setItems(initialData.items);
      }
    } else {
      resetForm();
    }
  }, [initialData, open]);

  const resetForm = () => {
    setName('');
    setAmount('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setCategory('utility');
    setSplitType('even');
    setRecurring(false);
    setFrequency('monthly');
    setRecurrenceEndType('after');
    setRecurrenceCount('12');
    // Default end date to 1 year from now
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    setRecurrenceEndDate(oneYearFromNow.toISOString().split('T')[0]);
    setNotes('');
    setCustomSplits({});
    setItems([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const parsedCustomSplits: Record<string, number> = {};
      if (splitType === 'custom' || splitType === 'percentage') {
        Object.entries(customSplits).forEach(([k, v]) => {
          parsedCustomSplits[k] = parseFloat(v) || 0;
        });
      }

      // Calculate total from items if using item-based split
      const finalAmount = splitType === 'items'
        ? items.reduce((sum, item) => sum + item.amount, 0)
        : parseFloat(amount);

      const billData = {
        name,
        amount: finalAmount,
        dueDate,
        category,
        splitType,
        paidBy: initialData?.paidBy || null,
        paidDate: initialData?.paidDate || null,
        isPaid: initialData?.isPaid || false,
        status: initialData?.status || 'pending',
        recurring,
        frequency: recurring ? frequency : 'once',
        customSplits: (splitType === 'custom' || splitType === 'percentage') ? parsedCustomSplits : undefined,
        items: splitType === 'items' ? items : undefined,
        notes: notes || undefined,
      };

      // Pass recurrence options if this is a recurring bill
      const recurrenceOpts = recurring && !initialData ? {
        endType: recurrenceEndType,
        count: recurrenceEndType === 'after' ? parseInt(recurrenceCount) || 12 : undefined,
        endDate: recurrenceEndType === 'on_date' ? recurrenceEndDate : undefined,
      } : undefined;

      await onSubmit(billData, recurrenceOpts);
      
      onClose();
      resetForm();
    } catch (err) {
      console.error('Error submitting bill:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const customSplitsTotal = Object.values(customSplits).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );

  const percentageTotal = splitType === 'percentage'
    ? Object.values(customSplits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            {initialData ? 'Edit Bill' : 'Add Bill'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {initialData ? 'Edit the details of an existing bill' : 'Add a new bill to track and split'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Bill Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Electric bill, Internet, etc."
                required
              />
            </div>

            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Bill['category'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon icon={cat.icon} className="w-4 h-4" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Split Type</Label>
              <Select value={splitType} onValueChange={(v) => setSplitType(v as Bill['splitType'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="even">Even Split</SelectItem>
                  <SelectItem value="mortgage">Mortgage Shares</SelectItem>
                  <SelectItem value="percentage">By Percentage</SelectItem>
                  <SelectItem value="custom">Custom Amounts</SelectItem>
                  <SelectItem value="items">By Items (Receipt)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recurring Bill Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="recurring" className="font-medium">Recurring Bill</Label>
              <p className="text-sm text-muted-foreground">Automatically repeat this bill</p>
            </div>
            <Switch
              id="recurring"
              checked={recurring}
              onCheckedChange={setRecurring}
            />
          </div>

          {recurring && (
            <div className="space-y-4 rounded-lg border p-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as BillFrequency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILL_FREQUENCIES.filter(f => f.value !== 'once').map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ends</Label>
                  <Select value={recurrenceEndType} onValueChange={(v) => setRecurrenceEndType(v as RecurrenceEndType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="after">After # of times</SelectItem>
                      <SelectItem value="on_date">On date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {recurrenceEndType === 'after' && (
                <div className="space-y-2">
                  <Label htmlFor="recurrenceCount">Number of occurrences</Label>
                  <Input
                    id="recurrenceCount"
                    type="number"
                    min="1"
                    max="52"
                    value={recurrenceCount}
                    onChange={(e) => setRecurrenceCount(e.target.value)}
                    placeholder="12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Will create {recurrenceCount || 0} bills
                  </p>
                </div>
              )}

              {recurrenceEndType === 'on_date' && (
                <div className="space-y-2">
                  <Label htmlFor="recurrenceEndDate">End date</Label>
                  <Input
                    id="recurrenceEndDate"
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    min={dueDate}
                  />
                </div>
              )}
            </div>
          )}

          {splitType === 'custom' && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Custom Splits</span>
                <span className={customSplitsTotal === parseFloat(amount) ? 'text-emerald-600' : 'text-amber-600'}>
                  ${customSplitsTotal.toFixed(2)} of ${parseFloat(amount || '0').toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <Label className="w-16 text-sm">{member.name}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-8"
                      value={customSplits[member.id] || ''}
                      onChange={(e) =>
                        setCustomSplits((prev) => ({
                          ...prev,
                          [member.id]: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {splitType === 'percentage' && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Percentage Splits</span>
                <span className={percentageTotal === 100 ? 'text-emerald-600' : 'text-amber-600'}>
                  {percentageTotal.toFixed(0)}% of 100%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <Label className="w-16 text-sm">{member.name}</Label>
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        className="h-8 pr-6"
                        value={customSplits[member.id] || ''}
                        onChange={(e) =>
                          setCustomSplits((prev) => ({
                            ...prev,
                            [member.id]: e.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
              {amount && percentageTotal > 0 && (
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  {members.map((member) => {
                    const pct = parseFloat(customSplits[member.id] || '0');
                    const share = (pct / 100) * parseFloat(amount);
                    return pct > 0 ? (
                      <div key={member.id} className="flex justify-between">
                        <span>{member.name}</span>
                        <span>${share.toFixed(2)}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {splitType === 'even' && amount && members.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Each person pays: ${(parseFloat(amount) / members.length).toFixed(2)}
            </p>
          )}

          {splitType === 'mortgage' && (
            <div className="text-sm text-muted-foreground">
              <p>Using fixed mortgage shares:</p>
              <p className="mt-1">
                {members.map((m) => `${m.name}: $${m.mortgageShare}`).join(' · ')}
              </p>
            </div>
          )}

          {splitType === 'items' && (
            <ReceiptItemsEditor
              items={items}
              members={members}
              onChange={setItems}
            />
          )}

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : initialData ? 'Update' : 'Add Bill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
