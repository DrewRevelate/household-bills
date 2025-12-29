export type BillStatus = 'pending' | 'paid' | 'partial' | 'overdue';
export type BillFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type AvatarColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan' | 'pink' | 'teal';

export interface Person {
  id: string;
  name: string;
  mortgageShare: number;
  email?: string;
  avatarColor?: AvatarColor;
  defaultSplitPercentage?: number;
  credit?: number; // Available credit from overpayments (can be applied to bills, not settlements)
  venmoHandle?: string; // Venmo username for direct payments
}

export interface ReceiptItem {
  id: string;
  name: string;
  amount: number;
  assignedTo: string[]; // array of person IDs
}

// Tracks when a payer explicitly covers someone else's share
export interface CoverageAllocation {
  payerId: string;      // Person who paid extra
  coveredId: string;    // Person whose share they covered
  amount: number;       // Amount covered
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // ISO date string
  category: BillCategory;
  splitType: 'mortgage' | 'even' | 'custom' | 'percentage' | 'items';
  paidBy: string | null; // person id who paid (single payer)
  paidContributions?: Record<string, number>; // personId -> amount paid (multi-payer)
  contributionDates?: Record<string, string>; // personId -> ISO date when they contributed
  creditUsed?: Record<string, number>; // personId -> credit amount used (for restoring on unpaid)
  creditEarned?: Record<string, number>; // personId -> credit earned from overpayment (for removing on unpaid)
  coverageAllocations?: CoverageAllocation[]; // Explicit coverage assignments (payer covers someone's share)
  paidDate: string | null; // ISO date string - when the bill was paid to vendor
  isPaid: boolean;
  status: BillStatus;
  recurring: boolean;
  frequency: BillFrequency;
  customSplits?: Record<string, number>; // personId -> amount or percentage
  items?: ReceiptItem[]; // for item-based splitting
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BillCategory = 'mortgage' | 'utility' | 'insurance' | 'subscription' | 'groceries' | 'internet' | 'transportation' | 'medical' | 'other';

export interface Balance {
  personId: string;
  personName: string;
  owes: number; // positive = owes money, negative = owed money
  details: {
    billId: string;
    billName: string;
    amount: number;
  }[];
}

export interface SettlementBreakdown {
  billId: string;
  billName: string;
  category: BillCategory;
  dueDate: string;
  totalAmount: number;
  theirShare: number;      // What debtor owed on this bill
  creditorPaid: number;    // What creditor paid toward debtor's share
}

export interface SettlementWithBreakdown {
  from: string;
  to: string;
  amount: number;
  breakdown: SettlementBreakdown[];
  // For netted settlements: bills going the other direction
  offsetBreakdown?: SettlementBreakdown[];
  grossOwed?: number;    // Total A owes B before netting
  grossOffset?: number;  // Total B owes A (offset)
  forgiven?: number;     // Amount forgiven by the creditor
}

// Record of forgiven/settled debts between members
export interface SettlementRecord {
  id: string;
  fromId: string;       // Person who owed money (debtor)
  toId: string;         // Person who was owed (creditor) - the one who forgives
  amount: number;       // Amount forgiven
  type: 'forgiven' | 'paid';  // 'forgiven' = wiped away, 'paid' = settled outside app
  note?: string;
  createdAt: string;
}

// Default household members with mortgage splits
export const HOUSEHOLD_MEMBERS: Person[] = [
  { id: 'drew', name: 'Drew', mortgageShare: 1300 },
  { id: 'steve', name: 'Steve', mortgageShare: 700 },
  { id: 'mom', name: 'Mom', mortgageShare: 500 },
  { id: 'dad', name: 'Dad', mortgageShare: 500 },
  { id: 'rose', name: 'Rose', mortgageShare: 500 },
];

export const MORTGAGE_TOTAL = 3564;
export const MORTGAGE_ASSIGNED = HOUSEHOLD_MEMBERS.reduce((sum, p) => sum + p.mortgageShare, 0);
export const MORTGAGE_GAP = MORTGAGE_TOTAL - MORTGAGE_ASSIGNED; // $64 unassigned

export const BILL_CATEGORIES = [
  { value: 'mortgage', label: 'Mortgage', icon: 'home' },
  { value: 'utility', label: 'Utility', icon: 'zap' },
  { value: 'insurance', label: 'Insurance', icon: 'shield' },
  { value: 'subscription', label: 'Subscription', icon: 'tv' },
  { value: 'groceries', label: 'Groceries', icon: 'shopping-cart' },
  { value: 'internet', label: 'Internet/Phone', icon: 'wifi' },
  { value: 'transportation', label: 'Transportation', icon: 'car' },
  { value: 'medical', label: 'Medical', icon: 'heart-pulse' },
  { value: 'other', label: 'Other', icon: 'file-text' },
] as const;

export const BILL_FREQUENCIES = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export const AVATAR_COLORS: { value: AvatarColor; class: string }[] = [
  { value: 'indigo', class: 'bg-indigo-500' },
  { value: 'emerald', class: 'bg-emerald-500' },
  { value: 'amber', class: 'bg-amber-500' },
  { value: 'rose', class: 'bg-rose-500' },
  { value: 'violet', class: 'bg-violet-500' },
  { value: 'cyan', class: 'bg-cyan-500' },
  { value: 'pink', class: 'bg-pink-500' },
  { value: 'teal', class: 'bg-teal-500' },
];

export function getBillStatus(bill: Bill): BillStatus {
  if (bill.isPaid) return 'paid';

  // Check for partial payment
  if (bill.paidContributions) {
    const totalPaid = Object.values(bill.paidContributions).reduce((sum, amt) => sum + amt, 0);
    if (totalPaid > 0 && totalPaid < bill.amount) {
      return 'partial';
    }
  }

  const today = new Date();
  const dueDate = new Date(bill.dueDate);
  return dueDate < today ? 'overdue' : 'pending';
}

export function getBillPaidAmount(bill: Bill): number {
  if (!bill.paidContributions) return bill.isPaid ? bill.amount : 0;
  return Object.values(bill.paidContributions).reduce((sum, amt) => sum + amt, 0);
}

export function getBillRemainingAmount(bill: Bill): number {
  return bill.amount - getBillPaidAmount(bill);
}
