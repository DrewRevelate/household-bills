/**
 * Settlement calculation functions
 * Handles debt calculation, netting, and breakdown generation
 * Extracted from hooks.ts for better testability
 */

import type {
  Bill,
  Person,
  SettlementBreakdown,
  SettlementWithBreakdown,
  SettlementRecord,
} from './types';
import { calculateBillShares, getBillContributions } from './bill-utils';

/**
 * Calculate what each person owes/is owed based on paid bills
 */
export function calculateBalances(bills: Bill[], members: Person[]) {
  const balances: Record<string, number> = {};

  // Initialize all members with 0 balance
  members.forEach((member) => {
    balances[member.id] = 0;
  });

  // Process paid and partially paid bills
  const paidBills = bills.filter(
    (bill) =>
      (bill.isPaid && (bill.paidBy || bill.paidContributions)) ||
      (bill.paidContributions &&
        Object.values(bill.paidContributions).some((amt) => amt > 0))
  );

  paidBills.forEach((bill) => {
    const shares = calculateBillShares(bill, members);
    const contributions = getBillContributions(bill);

    // Calculate total paid and total shares
    const totalPaid = Object.values(contributions).reduce((sum, amt) => sum + amt, 0);
    const totalShares = Object.values(shares).reduce((sum, amt) => sum + amt, 0);

    // Skip if nothing was paid or no shares assigned
    if (totalPaid < 0.01 || totalShares < 0.01) return;

    // For partially paid bills, only consider proportional responsibility
    const paidRatio = Math.min(totalPaid / totalShares, 1);

    // Each person's net = proportional share - what they paid
    // Positive = they owe money, Negative = they're owed money
    Object.entries(shares).forEach(([personId, share]) => {
      const paid = contributions[personId] || 0;
      const proportionalShare = share * paidRatio;
      balances[personId] += proportionalShare - paid;
    });

    // Handle payers who aren't in the share calculation
    Object.entries(contributions).forEach(([payerId, amountPaid]) => {
      if (!(payerId in shares)) {
        balances[payerId] -= amountPaid;
      }
    });
  });

  return members.map((member) => ({
    personId: member.id,
    personName: member.name,
    owes: Math.round(balances[member.id] * 100) / 100,
  }));
}

/**
 * Calculate net settlements (who pays whom) - simple version
 */
export function calculateSettlements(
  bills: Bill[],
  members: Person[],
  settlementRecords?: SettlementRecord[]
) {
  return calculateSettlementsWithBreakdown(bills, members, settlementRecords).map(
    ({ from, to, amount }) => ({
      from,
      to,
      amount,
    })
  );
}

/**
 * Calculate settlements with detailed bill breakdown
 * This is the main settlement calculation function
 */
export function calculateSettlementsWithBreakdown(
  bills: Bill[],
  members: Person[],
  settlementRecords?: SettlementRecord[]
): SettlementWithBreakdown[] {
  // Track per-bill debts: debtorId -> creditorId -> bill breakdown items
  const billDebts: Record<string, Record<string, SettlementBreakdown[]>> = {};

  // Initialize structure for all member pairs
  members.forEach((debtor) => {
    billDebts[debtor.id] = {};
    members.forEach((creditor) => {
      if (debtor.id !== creditor.id) {
        billDebts[debtor.id][creditor.id] = [];
      }
    });
  });

  // Process paid and partially paid bills
  const paidBills = bills.filter(
    (bill) =>
      (bill.isPaid && (bill.paidBy || bill.paidContributions)) ||
      (bill.paidContributions &&
        Object.values(bill.paidContributions).some((amt) => amt > 0))
  );

  paidBills.forEach((bill) => {
    const shares = calculateBillShares(bill, members);

    // If bill has explicit coverage allocations, use those ONLY
    // This is the new explicit system - no inference
    if (bill.coverageAllocations && bill.coverageAllocations.length > 0) {
      bill.coverageAllocations.forEach((coverage) => {
        // coveredId owes payerId the coverage amount
        if (coverage.amount > 0.01) {
          billDebts[coverage.coveredId][coverage.payerId].push({
            billId: bill.id,
            billName: bill.name,
            category: bill.category,
            dueDate: bill.dueDate,
            totalAmount: bill.amount,
            theirShare: shares[coverage.coveredId] || 0,
            creditorPaid: coverage.amount,
          });
        }
      });
      return; // Skip the inference logic for bills with explicit coverage
    }

    // Fallback: For fully paid bills without explicit coverage, use proportional inference
    const contributions = getBillContributions(bill);
    const totalPaid = Object.values(contributions).reduce((sum, amt) => sum + amt, 0);
    const totalShares = Object.values(shares).reduce((sum, amt) => sum + amt, 0);

    // Skip if nothing was paid or no shares assigned
    if (totalPaid < 0.01 || totalShares < 0.01) return;

    // Only infer debts for FULLY paid bills (within 1% tolerance)
    const isFullyPaid = totalPaid >= totalShares * 0.99;
    if (!isFullyPaid) return;

    // Calculate net position for each person on this bill
    // Important: Subtract creditEarned from "paid" because that money went to their
    // credit balance, NOT to covering others' shares
    const nets: Record<string, number> = {};
    members.forEach((m) => {
      const share = shares[m.id] || 0;
      const paid = contributions[m.id] || 0;
      const creditTaken = bill.creditEarned?.[m.id] || 0;
      // Effective contribution toward bill = paid - credit taken for themselves
      const effectivePaid = paid - creditTaken;
      nets[m.id] = share - effectivePaid; // positive = owes, negative = owed
    });

    // Find debtors and creditors for this bill
    const billDebtors = members.filter((m) => nets[m.id] > 0.01);
    const billCreditors = members.filter((m) => nets[m.id] < -0.01);

    // Distribute debts from each debtor to creditors proportionally
    const totalOwed = billCreditors.reduce((sum, c) => sum + Math.abs(nets[c.id]), 0);

    if (totalOwed < 0.01) return; // No one to pay back

    billDebtors.forEach((debtor) => {
      const debtorOwes = nets[debtor.id];

      billCreditors.forEach((creditor) => {
        const creditorOwed = Math.abs(nets[creditor.id]);
        // Proportion of this debtor's debt going to this creditor
        const proportion = creditorOwed / totalOwed;
        const amount = debtorOwes * proportion;

        if (amount > 0.01) {
          billDebts[debtor.id][creditor.id].push({
            billId: bill.id,
            billName: bill.name,
            category: bill.category,
            dueDate: bill.dueDate,
            totalAmount: bill.amount,
            theirShare: shares[debtor.id] || 0,
            creditorPaid: amount, // What creditor effectively covered for debtor
          });
        }
      });
    });
  });

  // Calculate forgiven amounts between each pair
  const getForgivenBetween = (fromId: string, toId: string) => {
    if (!settlementRecords) return 0;
    return settlementRecords
      .filter((r) => r.fromId === fromId && r.toId === toId)
      .reduce((sum, r) => sum + r.amount, 0);
  };

  // Aggregate into settlements with netting (A owes B $50, B owes A $20 -> A owes B $30)
  const settlements: SettlementWithBreakdown[] = [];
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const processed = new Set<string>();

  members.forEach((personA) => {
    members.forEach((personB) => {
      if (personA.id >= personB.id) return; // Only process each pair once

      const pairKey = `${personA.id}-${personB.id}`;
      if (processed.has(pairKey)) return;
      processed.add(pairKey);

      // Calculate what A owes B and what B owes A
      const aOwesB = billDebts[personA.id][personB.id];
      const bOwesA = billDebts[personB.id][personA.id];

      const totalAOwesB = aOwesB.reduce((sum, b) => sum + b.creditorPaid, 0);
      const totalBOwesA = bOwesA.reduce((sum, b) => sum + b.creditorPaid, 0);

      // Get forgiven amounts
      const forgivenAToB = getForgivenBetween(personA.id, personB.id);
      const forgivenBToA = getForgivenBetween(personB.id, personA.id);

      // Net the amounts (subtract forgiven amounts)
      const netAmount = totalAOwesB - forgivenAToB - (totalBOwesA - forgivenBToA);

      if (Math.abs(netAmount) > 0.01) {
        if (netAmount > 0) {
          // A owes B the net amount
          settlements.push({
            from: memberMap[personA.id],
            to: memberMap[personB.id],
            amount: Math.round(netAmount * 100) / 100,
            breakdown: aOwesB,
            offsetBreakdown: bOwesA.length > 0 ? bOwesA : undefined,
            grossOwed: Math.round(totalAOwesB * 100) / 100,
            grossOffset: bOwesA.length > 0 ? Math.round(totalBOwesA * 100) / 100 : undefined,
            forgiven: forgivenAToB > 0.01 ? Math.round(forgivenAToB * 100) / 100 : undefined,
          });
        } else {
          // B owes A the net amount
          settlements.push({
            from: memberMap[personB.id],
            to: memberMap[personA.id],
            amount: Math.round(Math.abs(netAmount) * 100) / 100,
            breakdown: bOwesA,
            offsetBreakdown: aOwesB.length > 0 ? aOwesB : undefined,
            grossOwed: Math.round(totalBOwesA * 100) / 100,
            grossOffset: aOwesB.length > 0 ? Math.round(totalAOwesB * 100) / 100 : undefined,
            forgiven: forgivenBToA > 0.01 ? Math.round(forgivenBToA * 100) / 100 : undefined,
          });
        }
      }
    });
  });

  return settlements;
}
