import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Bill, Person, CoverageAllocation } from './types';
import { HOUSEHOLD_MEMBERS } from './types';

// Re-export from extracted modules for backward compatibility
export { calculateBillShares, getBillContributions } from './bill-utils';
export {
  calculateBalances,
  calculateSettlements,
  calculateSettlementsWithBreakdown,
} from './settlements';

const BILLS_COLLECTION = 'bills';
const MEMBERS_COLLECTION = 'members';

export function useBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, BILLS_COLLECTION),
      orderBy('dueDate', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const billsData: Bill[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          billsData.push({
            id: doc.id,
            name: data.name,
            amount: data.amount,
            dueDate: data.dueDate,
            category: data.category,
            splitType: data.splitType,
            paidBy: data.paidBy,
            paidContributions: data.paidContributions,
            contributionDates: data.contributionDates,
            creditUsed: data.creditUsed,
            creditEarned: data.creditEarned,
            coverageAllocations: data.coverageAllocations,
            paidDate: data.paidDate,
            isPaid: data.isPaid,
            status: data.status || 'pending',
            recurring: data.recurring || false,
            frequency: data.frequency || 'once',
            customSplits: data.customSplits,
            items: data.items,
            notes: data.notes,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setBills(billsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching bills:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addBill = async (bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    // Filter out undefined values - Firestore doesn't accept undefined
    const cleanBill = Object.fromEntries(
      Object.entries(bill).filter(([, value]) => value !== undefined)
    );
    await addDoc(collection(db, BILLS_COLLECTION), {
      ...cleanBill,
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateBill = async (id: string, updates: Partial<Bill>) => {
    const billRef = doc(db, BILLS_COLLECTION, id);
    // Convert undefined values to deleteField() to remove them from Firestore
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      cleanUpdates[key] = value === undefined ? deleteField() : value;
    }
    await updateDoc(billRef, {
      ...cleanUpdates,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteBill = async (id: string) => {
    const billRef = doc(db, BILLS_COLLECTION, id);
    await deleteDoc(billRef);
  };

  const markAsPaid = async (
    id: string,
    paidBy: string | null,
    contributions?: Record<string, number>,
    billAmount?: number,
    coverageAllocations?: CoverageAllocation[],
    creditUsed?: Record<string, number>,
    creditEarned?: Record<string, number>,
    paidDate?: string, // ISO date string, defaults to today if not provided
    contributionDates?: Record<string, string> // ISO date strings for when each person contributed
  ) => {
    // Calculate total paid
    let totalPaid = 0;
    if (contributions) {
      totalPaid = Object.values(contributions).reduce((sum, amt) => sum + amt, 0);
    } else if (paidBy && billAmount) {
      totalPaid = billAmount; // Single payer pays full amount
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
      paidDate: paidDate || new Date().toISOString(),
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
    const oldBills = bills.filter((bill) => bill.dueDate < cutoffDate);
    if (oldBills.length === 0) return 0;

    // Use batch for atomic deletion
    const batch = writeBatch(db);
    oldBills.forEach((bill) => {
      batch.delete(doc(db, BILLS_COLLECTION, bill.id));
    });
    await batch.commit();
    return oldBills.length;
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
  };
}

export function useMembers() {
  const [members, setMembers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, MEMBERS_COLLECTION),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty && !initialized) {
          // Initialize with default members on first load
          try {
            for (const member of HOUSEHOLD_MEMBERS) {
              await setDoc(doc(db, MEMBERS_COLLECTION, member.id), {
                name: member.name,
                mortgageShare: member.mortgageShare,
              });
            }
            setInitialized(true);
          } catch (err) {
            console.error('Error initializing members:', err);
          }
          return;
        }

        const membersData: Person[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          membersData.push({
            id: doc.id,
            name: data.name,
            mortgageShare: data.mortgageShare || 0,
            email: data.email,
            avatarColor: data.avatarColor,
            defaultSplitPercentage: data.defaultSplitPercentage,
            credit: data.credit || 0,
            venmoHandle: data.venmoHandle,
          });
        });
        setMembers(membersData);
        setLoading(false);
        setInitialized(true);
      },
      (err) => {
        console.error('Error fetching members:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [initialized]);

  const addMember = async (member: Omit<Person, 'id'>) => {
    const id = member.name.toLowerCase().replace(/\s+/g, '-');
    // Filter out undefined values - Firestore doesn't accept undefined
    const cleanMember = Object.fromEntries(
      Object.entries(member).filter(([, value]) => value !== undefined)
    );
    await setDoc(doc(db, MEMBERS_COLLECTION, id), cleanMember);
  };

  const updateMember = async (id: string, updates: Partial<Person>) => {
    const memberRef = doc(db, MEMBERS_COLLECTION, id);
    // Filter out undefined values - Firestore doesn't accept undefined
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await updateDoc(memberRef, cleanUpdates);
  };

  const deleteMember = async (id: string) => {
    const memberRef = doc(db, MEMBERS_COLLECTION, id);
    await deleteDoc(memberRef);
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
  };
}

const SETTLEMENTS_COLLECTION = 'settlementRecords';

export function useSettlementRecords() {
  const [records, setRecords] = useState<import('./types').SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, SETTLEMENTS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const recordsData: import('./types').SettlementRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          recordsData.push({
            id: docSnap.id,
            fromId: data.fromId,
            toId: data.toId,
            amount: data.amount,
            type: data.type,
            note: data.note,
            createdAt: data.createdAt,
          });
        });
        setRecords(recordsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching settlement records:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addSettlementRecord = async (record: Omit<import('./types').SettlementRecord, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, SETTLEMENTS_COLLECTION), {
      ...record,
      createdAt: new Date().toISOString(),
    });
  };

  const deleteSettlementRecord = async (id: string) => {
    await deleteDoc(doc(db, SETTLEMENTS_COLLECTION, id));
  };

  const clearAllSettlementRecords = async () => {
    if (records.length === 0) return;

    // Use batch for atomic deletion
    const batch = writeBatch(db);
    records.forEach((record) => {
      batch.delete(doc(db, SETTLEMENTS_COLLECTION, record.id));
    });
    await batch.commit();
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
  };
}
