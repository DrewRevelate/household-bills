/**
 * Bill utility functions for calculating shares and contributions
 * Extracted from hooks.ts for better testability and reusability
 */

import type { Bill, Person } from './types';

/**
 * Calculate each person's share of a bill based on split type
 */
export function calculateBillShares(bill: Bill, members: Person[]): Record<string, number> {
  let shares: Record<string, number> = {};

  if (bill.splitType === 'mortgage') {
    members.forEach((member) => {
      shares[member.id] = member.mortgageShare;
    });
  } else if (bill.splitType === 'even') {
    const evenShare = bill.amount / members.length;
    members.forEach((member) => {
      shares[member.id] = evenShare;
    });
  } else if (bill.splitType === 'percentage' && bill.customSplits) {
    members.forEach((member) => {
      const percentage = bill.customSplits![member.id] || 0;
      shares[member.id] = (percentage / 100) * bill.amount;
    });
  } else if (bill.splitType === 'custom' && bill.customSplits) {
    shares = { ...bill.customSplits };
  } else if (bill.splitType === 'items' && bill.items) {
    members.forEach((member) => {
      shares[member.id] = 0;
    });
    bill.items.forEach((item) => {
      if (item.assignedTo.length > 0) {
        const perPerson = item.amount / item.assignedTo.length;
        item.assignedTo.forEach((personId) => {
          shares[personId] = (shares[personId] || 0) + perPerson;
        });
      }
    });
  }

  return shares;
}

/**
 * Get payment contributions for a bill (supports multi-payer)
 * Returns a map of personId -> amount paid
 */
export function getBillContributions(bill: Bill): Record<string, number> {
  if (bill.paidContributions) {
    return bill.paidContributions;
  } else if (bill.paidBy) {
    return { [bill.paidBy]: bill.amount };
  }
  return {};
}

/**
 * Check if a bill is fully paid (within tolerance)
 */
export function isBillFullyPaid(bill: Bill, tolerance = 0.01): boolean {
  const contributions = getBillContributions(bill);
  const totalPaid = Object.values(contributions).reduce((sum, amt) => sum + amt, 0);
  return totalPaid >= bill.amount - tolerance;
}

/**
 * Get total amount paid on a bill
 */
export function getTotalPaid(bill: Bill): number {
  const contributions = getBillContributions(bill);
  return Object.values(contributions).reduce((sum, amt) => sum + amt, 0);
}

/**
 * Get remaining amount on a bill
 */
export function getRemainingAmount(bill: Bill): number {
  return Math.max(0, bill.amount - getTotalPaid(bill));
}

/**
 * Calculate net position for each person on a bill
 * Positive = owes money, Negative = owed money (paid more than share)
 */
export function calculateNetPositions(
  bill: Bill,
  members: Person[]
): Record<string, number> {
  const shares = calculateBillShares(bill, members);
  const contributions = getBillContributions(bill);
  const nets: Record<string, number> = {};

  members.forEach((m) => {
    const share = shares[m.id] || 0;
    const paid = contributions[m.id] || 0;
    nets[m.id] = share - paid; // positive = owes, negative = owed
  });

  return nets;
}

/**
 * Member's monthly bill breakdown
 */
export interface MemberMonthlyBill {
  memberId: string;
  memberName: string;
  totalShare: number;      // Total they owe for the month
  amountPaid: number;      // What they've contributed
  remaining: number;       // totalShare - amountPaid
  billBreakdown: {         // Per-bill details
    billId: string;
    billName: string;
    share: number;
    paid: number;
    remaining: number;
    dueDate: string;
    isPaid: boolean;
  }[];
}

/**
 * Calculate monthly bills for each member
 * Groups bills by due date month and calculates each member's share
 */
export function calculateMonthlyMemberBills(
  bills: Bill[],
  members: Person[],
  month: number, // 0-11
  year: number
): MemberMonthlyBill[] {
  // Filter bills to the target month based on due date
  const monthBills = bills.filter((bill) => {
    const [billYear, billMonth] = bill.dueDate.split('-').map(Number);
    return billMonth - 1 === month && billYear === year;
  });

  // Calculate each member's monthly bill
  return members.map((member) => {
    let totalShare = 0;
    let amountPaid = 0;
    const billBreakdown: MemberMonthlyBill['billBreakdown'] = [];

    monthBills.forEach((bill) => {
      const shares = calculateBillShares(bill, members);
      const contributions = getBillContributions(bill);

      const memberShare = shares[member.id] || 0;
      const memberPaid = contributions[member.id] || 0;

      if (memberShare > 0.01) {
        totalShare += memberShare;
        amountPaid += memberPaid;

        billBreakdown.push({
          billId: bill.id,
          billName: bill.name,
          share: Math.round(memberShare * 100) / 100,
          paid: Math.round(memberPaid * 100) / 100,
          remaining: Math.round(Math.max(0, memberShare - memberPaid) * 100) / 100,
          dueDate: bill.dueDate,
          isPaid: bill.isPaid,
        });
      }
    });

    // Sort breakdown by due date
    billBreakdown.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      memberId: member.id,
      memberName: member.name,
      totalShare: Math.round(totalShare * 100) / 100,
      amountPaid: Math.round(amountPaid * 100) / 100,
      remaining: Math.round(Math.max(0, totalShare - amountPaid) * 100) / 100,
      billBreakdown,
    };
  });
}

/**
 * Get unpaid bills where a member has a remaining share
 * Used for distributing a payment across bills
 */
export function getUnpaidBillsForMember(
  bills: Bill[],
  members: Person[],
  memberId: string
): { bill: Bill; share: number; paid: number; remaining: number }[] {
  const result: { bill: Bill; share: number; paid: number; remaining: number }[] = [];

  bills
    .filter((bill) => !bill.isPaid)
    .forEach((bill) => {
      const shares = calculateBillShares(bill, members);
      const contributions = getBillContributions(bill);

      const share = shares[memberId] || 0;
      const paid = contributions[memberId] || 0;
      const remaining = Math.max(0, share - paid);

      if (remaining > 0.01) {
        result.push({ bill, share, paid, remaining });
      }
    });

  // Sort by due date (oldest first)
  result.sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate));

  return result;
}
