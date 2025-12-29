import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useBills, useMembers, useSettlementRecords } from '@/lib/hooks';
import type { Bill } from '@/lib/types';
import { LoginPage } from '@/components/LoginPage';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { BillsPage } from '@/pages/Bills';
import { SettlementsPage } from '@/pages/Settlements';
import { MembersPage } from '@/pages/Members';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Auth gate component - handles login and access control
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, isAllowed, signOut } = useAuth();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-600" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Show unauthorized screen if user is not in allowed list
  if (!isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900">Access Denied</h2>
          <p className="mt-2 text-zinc-600">
            This app is only available to household members. If you believe this is an error, contact Andrew.
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            Signed in as: {user.phoneNumber || user.email}
          </p>
          <button
            onClick={() => signOut()}
            className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Main app content - only rendered after auth is confirmed
function AppContent() {
  const { isAdmin } = useAuth();
  const { bills, loading: billsLoading, error: billsError, addBill, updateBill, deleteBill, deleteOldBills, markAsPaid, markAsUnpaid } = useBills();
  const { members, loading: membersLoading, error: membersError, addMember, updateMember, deleteMember, addCredit, useCredit } = useMembers();
  const { records: settlementRecords, loading: settlementsLoading, addSettlementRecord, clearAllSettlementRecords } = useSettlementRecords();

  const loading = billsLoading || membersLoading || settlementsLoading;
  const error = billsError || membersError;

  // Helper to calculate next due date based on frequency
  const getNextDueDate = (currentDate: string, frequency: string): string => {
    const date = new Date(currentDate);
    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString().split('T')[0];
  };

  // Handlers with toast notifications
  const handleAddBill = async (
    bill: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>,
    recurrenceOptions?: { endType: 'after' | 'on_date'; count?: number; endDate?: string }
  ) => {
    try {
      // If recurring with options, generate all the bills
      if (bill.recurring && recurrenceOptions) {
        const billsToCreate: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>[] = [];
        let currentDueDate = bill.dueDate;

        if (recurrenceOptions.endType === 'after' && recurrenceOptions.count) {
          // Create X number of bills
          for (let i = 0; i < recurrenceOptions.count; i++) {
            billsToCreate.push({
              ...bill,
              dueDate: currentDueDate,
              name: i === 0 ? bill.name : `${bill.name} (${i + 1}/${recurrenceOptions.count})`,
            });
            currentDueDate = getNextDueDate(currentDueDate, bill.frequency);
          }
        } else if (recurrenceOptions.endType === 'on_date' && recurrenceOptions.endDate) {
          // Create bills until end date
          const endDate = new Date(recurrenceOptions.endDate);
          let count = 0;
          const maxBills = 52; // Safety limit

          while (new Date(currentDueDate) <= endDate && count < maxBills) {
            billsToCreate.push({
              ...bill,
              dueDate: currentDueDate,
              name: count === 0 ? bill.name : `${bill.name} (${count + 1})`,
            });
            currentDueDate = getNextDueDate(currentDueDate, bill.frequency);
            count++;
          }
        }

        // Create all bills
        for (const b of billsToCreate) {
          await addBill(b);
        }
        toast.success(`Created ${billsToCreate.length} recurring bills`);
      } else {
        // Single bill
        await addBill(bill);
        toast.success('Bill added');
      }
    } catch {
      toast.error('Failed to add bill');
    }
  };

  const handleUpdateBill = async (id: string, updates: Partial<Bill>) => {
    try {
      await updateBill(id, updates);
      toast.success('Bill updated');
    } catch {
      toast.error('Failed to update bill');
    }
  };

  const handleDeleteBill = async (id: string) => {
    try {
      await deleteBill(id);
      toast.success('Bill deleted');
    } catch {
      toast.error('Failed to delete bill');
    }
  };

  const handleMarkPaid = async (
    id: string,
    paidBy: string | null,
    contributions?: Record<string, number>,
    billAmount?: number,
    coverageAllocations?: import('@/lib/types').CoverageAllocation[],
    creditUsed?: Record<string, number>,
    creditEarned?: Record<string, number>,
    paidDate?: string
  ) => {
    try {
      await markAsPaid(id, paidBy, contributions, billAmount, coverageAllocations, creditUsed, creditEarned, paidDate);
      // Determine if it's a partial or full payment
      const totalPaid = contributions
        ? Object.values(contributions).reduce((sum, amt) => sum + amt, 0)
        : billAmount || 0;
      const isPartial = billAmount && totalPaid < billAmount - 0.01;
      toast.success(isPartial ? 'Partial payment recorded' : 'Marked as paid');
    } catch {
      toast.error('Failed to update bill');
    }
  };

  const handleMarkUnpaid = async (id: string) => {
    try {
      // Find the bill to restore/remove credits
      const bill = bills.find((b) => b.id === id);
      if (bill?.creditUsed) {
        // Restore credits to each member who used them
        for (const [memberId, amount] of Object.entries(bill.creditUsed)) {
          await addCredit(memberId, amount);
        }
      }
      if (bill?.creditEarned) {
        // Remove credits that were earned from overpayments
        for (const [memberId, amount] of Object.entries(bill.creditEarned)) {
          await useCredit(memberId, amount);
        }
      }
      await markAsUnpaid(id);
      toast.success('Marked as unpaid');
    } catch {
      toast.error('Failed to update bill');
    }
  };

  const handleAddMember = async (member: Omit<typeof members[0], 'id'>) => {
    try {
      await addMember(member);
      toast.success('Member added');
    } catch {
      toast.error('Failed to add member');
    }
  };

  const handleUpdateMember = async (id: string, updates: Partial<typeof members[0]>) => {
    try {
      await updateMember(id, updates);
      toast.success('Member updated');
    } catch {
      toast.error('Failed to update member');
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteMember(id);
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleForgiveDebt = async (fromId: string, toId: string, amount: number) => {
    try {
      await addSettlementRecord({
        fromId,
        toId,
        amount,
        type: 'forgiven',
      });
      const creditorName = members.find((m) => m.id === toId)?.name || 'Member';
      toast.success(`${creditorName} forgave $${amount.toFixed(2)}`);
    } catch {
      toast.error('Failed to record forgiveness');
    }
  };

  const handleMarkSettlementPaid = async (fromId: string, toId: string, amount: number) => {
    try {
      await addSettlementRecord({
        fromId,
        toId,
        amount,
        type: 'paid',
      });
      const debtorName = members.find((m) => m.id === fromId)?.name || 'Member';
      toast.success(`${debtorName}'s payment of $${amount.toFixed(2)} confirmed`);
    } catch {
      toast.error('Failed to record payment');
    }
  };

  const handleClearForgiveness = async () => {
    try {
      await clearAllSettlementRecords();
      toast.success('Cleared all forgiveness records');
    } catch {
      toast.error('Failed to clear forgiveness records');
    }
  };

  const handleDeleteOldBills = async (cutoffDate: string) => {
    try {
      const count = await deleteOldBills(cutoffDate);
      toast.success(`Deleted ${count} bills before ${cutoffDate}`);
      return count;
    } catch {
      toast.error('Failed to delete old bills');
      return 0;
    }
  };

  const handlePayMemberShare = async (
    memberId: string,
    payments: { billId: string; amount: number }[]
  ) => {
    try {
      const memberName = members.find((m) => m.id === memberId)?.name || 'Member';
      let totalPaid = 0;

      for (const payment of payments) {
        const bill = bills.find((b) => b.id === payment.billId);
        if (!bill) continue;

        // Add member's contribution to existing contributions
        const existingContributions = bill.paidContributions || {};
        const newContributions = {
          ...existingContributions,
          [memberId]: (existingContributions[memberId] || 0) + payment.amount,
        };

        // Calculate total paid including this new contribution
        const totalBillPaid = Object.values(newContributions).reduce((sum, amt) => sum + amt, 0);
        const isFullyPaid = totalBillPaid >= bill.amount - 0.01;

        await markAsPaid(
          bill.id,
          null, // multi-payer
          newContributions,
          bill.amount,
          undefined, // no coverage allocations
          undefined, // no credit used
          undefined, // no credit earned
          isFullyPaid ? new Date().toISOString().split('T')[0] : undefined
        );

        totalPaid += payment.amount;
      }

      toast.success(`${memberName} paid $${totalPaid.toFixed(2)}`);
    } catch {
      toast.error('Failed to record payment');
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800">Connection Error</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <p className="mt-4 text-xs text-red-500">
            Check your Firebase configuration in src/lib/firebase.ts
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard bills={bills} members={members} onPayMemberShare={handlePayMemberShare} />} />
        <Route
          path="/bills"
          element={
            <BillsPage
              bills={bills}
              members={members}
              onAddBill={handleAddBill}
              onUpdateBill={handleUpdateBill}
              onDeleteBill={handleDeleteBill}
              onMarkPaid={handleMarkPaid}
              onMarkUnpaid={handleMarkUnpaid}
              onAddCredit={addCredit}
              onUseCredit={useCredit}
              onDeleteOldBills={handleDeleteOldBills}
            />
          }
        />
        <Route
          path="/settlements"
          element={
            <SettlementsPage
              bills={bills}
              members={members}
              settlementRecords={settlementRecords}
              onForgiveDebt={isAdmin ? handleForgiveDebt : undefined}
              onMarkSettlementPaid={handleMarkSettlementPaid}
              onClearForgiveness={isAdmin ? handleClearForgiveness : undefined}
            />
          }
        />
        <Route
          path="/members"
          element={
            <MembersPage
              members={members}
              bills={bills}
              onAdd={handleAddMember}
              onUpdate={handleUpdateMember}
              onDelete={handleDeleteMember}
            />
          }
        />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <AppContent />
      </AuthGate>
      <Toaster position="bottom-center" />
    </BrowserRouter>
  );
}

export default App;
