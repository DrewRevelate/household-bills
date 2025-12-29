import { useState, useEffect, useCallback } from 'react';
import { membersApi, billsApi, settlementsApi } from './api';
import type { Bill, Person, CoverageAllocation, SettlementRecord } from './types';

// Re-export from extracted modules for backward compatibility
export { calculateBillShares, getBillContributions } from './bill-utils';
export {
  calculateBalances,
  calculateSettlements,
  calculateSettlementsWithBreakdown,
} from './settlements';

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    try {
      const data = await billsApi.getAll();
      setBills(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchBills, 30000);
    return () => clearInterval(interval);
  }, [fetchBills]);

  const addBill = async (bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>) => {
    await billsApi.create(bill);
    await fetchBills();
  };

  const updateBill = async (id: string, updates: Partial<Bill>) => {
    await billsApi.update(id, {
      ...updates,
    });
    await fetchBills();
  };

  const deleteBill = async (id: string) => {
    await billsApi.delete(id);
    await fetchBills();
  };

  const markAsPaid = async (
    id: string,
    paidBy: string | null,
    contributions?: Record<string, number>,
    billAmount?: number,
    coverageAllocations?: CoverageAllocation[],
    creditUsed?: Record<string, number>,
    creditEarned?: Record<string, number>,
    paidDate?: string,
    contributionDates?: Record<string, string>
  ) => {
    // Calculate total paid
    let totalPaid = 0;
    if (contributions) {
      totalPaid = Object.values(contributions).reduce((sum, amt) => sum + amt, 0);
    } else if (paidBy && billAmount) {
      totalPaid = billAmount;
    }

    // Determine if this is a full payment
    const isFullPayment = billAmount ? totalPaid >= billAmount - 0.01 : true;

    await updateBill(id, {
      isPaid: isFullPayment,
      paidBy,
      paidContributions: contributions,
      contributionDates,
      creditUsed,
      creditEarned,
      coverageAllocations,
      paidDate: paidDate || new Date().toISOString().split('T')[0],
    });
  };

  const markAsUnpaid = async (id: string) => {
    await updateBill(id, {
      isPaid: false,
      paidBy: null,
      paidContributions: undefined,
      contributionDates: undefined,
      creditUsed: undefined,
      creditEarned: undefined,
      coverageAllocations: undefined,
      paidDate: null,
    });
  };

  const deleteOldBills = async (cutoffDate: string) => {
    const result = await billsApi.bulkDelete(cutoffDate);
    await fetchBills();
    return result.deleted;
  };

  return {
    bills,
    loading,
    error,
    addBill,
    updateBill,
    deleteBill,
    deleteOldBills,
    markAsPaid,
    markAsUnpaid,
    refetch: fetchBills,
  };
}

export function useMembers() {
  const [members, setMembers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await membersApi.getAll();
      setMembers(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchMembers, 30000);
    return () => clearInterval(interval);
  }, [fetchMembers]);

  const addMember = async (member: Omit<Person, 'id'>) => {
    await membersApi.create(member);
    await fetchMembers();
  };

  const updateMember = async (id: string, updates: Partial<Person>) => {
    await membersApi.update(id, updates);
    await fetchMembers();
  };

  const deleteMember = async (id: string) => {
    await membersApi.delete(id);
    await fetchMembers();
  };

  // Add credit to a member (from overpayment)
  const addCredit = async (id: string, amount: number) => {
    const member = members.find((m) => m.id === id);
    const currentCredit = member?.credit || 0;
    await updateMember(id, { credit: currentCredit + amount });
  };

  // Use credit from a member (apply to a bill)
  const useCredit = async (id: string, amount: number) => {
    const member = members.find((m) => m.id === id);
    const currentCredit = member?.credit || 0;
    const newCredit = Math.max(0, currentCredit - amount);
    await updateMember(id, { credit: newCredit });
  };

  // Set credit to a specific amount
  const setCredit = async (id: string, amount: number) => {
    await updateMember(id, { credit: Math.max(0, amount) });
  };

  return {
    members,
    loading,
    error,
    addMember,
    updateMember,
    deleteMember,
    addCredit,
    useCredit,
    setCredit,
    refetch: fetchMembers,
  };
}

export function useSettlementRecords() {
  const [records, setRecords] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await settlementsApi.getAll();
      setRecords(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching settlement records:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchRecords, 30000);
    return () => clearInterval(interval);
  }, [fetchRecords]);

  const addSettlementRecord = async (record: Omit<SettlementRecord, 'id' | 'createdAt'>) => {
    await settlementsApi.create(record);
    await fetchRecords();
  };

  const deleteSettlementRecord = async (id: string) => {
    await settlementsApi.delete(id);
    await fetchRecords();
  };

  const clearAllSettlementRecords = async () => {
    await settlementsApi.clearAll();
    await fetchRecords();
  };

  // Get total forgiven amount between two people
  const getForgivenAmount = (fromId: string, toId: string) => {
    return records
      .filter((r) => r.fromId === fromId && r.toId === toId)
      .reduce((sum, r) => sum + r.amount, 0);
  };

  return {
    records,
    loading,
    error,
    addSettlementRecord,
    deleteSettlementRecord,
    clearAllSettlementRecords,
    getForgivenAmount,
    refetch: fetchRecords,
  };
}
