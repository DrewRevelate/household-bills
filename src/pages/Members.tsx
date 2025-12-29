import { useState, useMemo } from 'react';
import type { Person, Bill } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Smartphone,
  Users,
  DollarSign,
  Coins,
  XCircle,
} from 'lucide-react';
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
import { MemberForm } from '@/components/MemberForm';
import { MemberAvatar } from '@/components/MemberAvatar';
import { MemberDetailDialog } from '@/components/MemberDetailDialog';
import { PaymentBreakdownDialog } from '@/components/PaymentBreakdownDialog';

interface MembersPageProps {
  members: Person[];
  bills?: Bill[];
  onAdd: (member: Omit<Person, 'id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function MembersPage({ members, bills = [], onAdd, onUpdate, onDelete }: MembersPageProps) {
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Person | null>(null);
  const [deletingMember, setDeletingMember] = useState<Person | null>(null);
  const [clearingCreditMember, setClearingCreditMember] = useState<Person | null>(null);
  const [selectedMember, setSelectedMember] = useState<Person | null>(null);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);

  const getMemberStats = (memberId: string) => {
    let totalPaid = 0;
    let billsCount = 0;

    bills.forEach((b) => {
      if (!b.isPaid) return;

      if (b.paidContributions && b.paidContributions[memberId]) {
        totalPaid += b.paidContributions[memberId];
        billsCount++;
      }
      else if (b.paidBy === memberId) {
        totalPaid += b.amount;
        billsCount++;
      }
    });

    return { totalPaid, billsCount };
  };

  const totalMortgage = useMemo(
    () => members.reduce((sum, m) => sum + m.mortgageShare, 0),
    [members]
  );

  const handleSubmitMember = async (data: Omit<Person, 'id'>) => {
    if (editingMember) {
      await onUpdate(editingMember.id, data);
    } else {
      await onAdd(data);
    }
    setShowMemberForm(false);
    setEditingMember(null);
  };

  const handleDelete = async () => {
    if (deletingMember) {
      await onDelete(deletingMember.id);
      setDeletingMember(null);
    }
  };

  const handleClearCredit = async () => {
    if (clearingCreditMember) {
      await onUpdate(clearingCreditMember.id, { credit: 0 });
      setClearingCreditMember(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              {members.length === 0 ? 'Add your household' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
            </h1>
            <p className="text-slate-500 text-lg mt-2">
              {members.length === 0
                ? 'Get started by adding family members'
                : `$${totalMortgage.toFixed(0)}/mo combined mortgage`
              }
            </p>
          </div>
          <Button
            onClick={() => setShowMemberForm(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm text-lg px-6 py-3 h-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add member
          </Button>
        </div>

        {/* Members List */}
        {members.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            <AnimatePresence>
              {members.map((member, index) => {
                const stats = getMemberStats(member.id);

                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-5 sm:p-6 hover:bg-slate-50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedMember(member)}
                  >
                    <div className="flex items-center gap-5">
                      {/* Avatar */}
                      <MemberAvatar member={member} size="xl" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 text-2xl">{member.name}</p>
                          <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Tap for details</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                          {member.email && (
                            <span className="text-lg text-slate-500 flex items-center gap-2">
                              <Mail className="w-5 h-5" />
                              <span className="truncate max-w-[220px]">{member.email}</span>
                            </span>
                          )}
                          {member.venmoHandle && (
                            <span className="text-lg text-slate-500 flex items-center gap-2">
                              <Smartphone className="w-5 h-5" />
                              <span className="truncate max-w-[200px]">@{member.venmoHandle}</span>
                            </span>
                          )}
                          {member.defaultSplitPercentage !== undefined && (
                            <span className="text-lg text-slate-500">
                              {member.defaultSplitPercentage}% default split
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-8 text-right">
                        <div>
                          <p className="text-sm text-slate-400 uppercase tracking-wide font-medium">Mortgage</p>
                          <p className="font-bold text-slate-900 text-xl">${member.mortgageShare.toFixed(0)}</p>
                        </div>
                        {(member.credit || 0) > 0 && (
                          <div>
                            <p className="text-sm text-violet-500 uppercase tracking-wide font-medium">Credit</p>
                            <p className="font-bold text-violet-600 text-xl flex items-center gap-1 justify-end">
                              <Coins className="w-5 h-5" />
                              {(member.credit || 0).toFixed(2)}
                            </p>
                          </div>
                        )}
                        {stats.totalPaid > 0 && (
                          <div>
                            <p className="text-sm text-slate-400 uppercase tracking-wide font-medium">Paid</p>
                            <p className="font-bold text-emerald-600 text-xl flex items-center gap-1 justify-end">
                              <DollarSign className="w-5 h-5" />
                              {stats.totalPaid.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 text-slate-400 hover:text-slate-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-6 h-6" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-lg py-3"
                            onClick={() => {
                              setEditingMember(member);
                              setShowMemberForm(true);
                            }}
                          >
                            <Pencil className="w-5 h-5 mr-3" />
                            Edit
                          </DropdownMenuItem>
                          {(member.credit || 0) > 0 && (
                            <DropdownMenuItem
                              onClick={() => setClearingCreditMember(member)}
                              className="text-amber-600 text-lg py-3"
                            >
                              <XCircle className="w-5 h-5 mr-3" />
                              Clear credits (${(member.credit || 0).toFixed(2)})
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setDeletingMember(member)}
                            className="text-red-600 text-lg py-3"
                          >
                            <Trash2 className="w-5 h-5 mr-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Mobile Stats */}
                    <div className="flex sm:hidden items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div className="flex-1">
                        <p className="text-sm text-slate-400 uppercase tracking-wide">Mortgage</p>
                        <p className="font-bold text-slate-900 text-xl">${member.mortgageShare.toFixed(0)}/mo</p>
                      </div>
                      {(member.credit || 0) > 0 && (
                        <div className="flex-1 text-center">
                          <p className="text-sm text-violet-500 uppercase tracking-wide">Credit</p>
                          <p className="font-bold text-violet-600 text-xl">${(member.credit || 0).toFixed(2)}</p>
                        </div>
                      )}
                      {stats.totalPaid > 0 && (
                        <div className="flex-1 text-right">
                          <p className="text-sm text-slate-400 uppercase tracking-wide">Total Paid</p>
                          <p className="font-bold text-emerald-600 text-xl">${stats.totalPaid.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-14 text-center">
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-900 text-xl">No family members yet</h3>
            <p className="text-lg text-slate-500 mt-2">Add members to start splitting bills</p>
            <Button
              onClick={() => setShowMemberForm(true)}
              className="mt-6 bg-slate-900 hover:bg-slate-800 text-white text-lg px-8 py-4 h-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add first member
            </Button>
          </div>
        )}

        {/* Quick Add */}
        {members.length > 0 && (
          <Button
            onClick={() => setShowMemberForm(true)}
            variant="outline"
            className="w-full mt-6 py-8 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 text-xl"
          >
            <Plus className="w-6 h-6 mr-3" />
            Add another member
          </Button>
        )}
      </div>

      <MemberForm
        open={showMemberForm}
        onClose={() => {
          setShowMemberForm(false);
          setEditingMember(null);
        }}
        onSubmit={handleSubmitMember}
        member={editingMember}
      />

      <AlertDialog open={!!deletingMember} onOpenChange={() => setDeletingMember(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">Delete Member</AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              Are you sure you want to remove {deletingMember?.name} from the family? This will also
              remove all their bill splits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-lg px-6 py-3 h-auto">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!clearingCreditMember} onOpenChange={() => setClearingCreditMember(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl flex items-center gap-2">
              <XCircle className="w-6 h-6 text-amber-500" />
              Clear Credits
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              Clear <span className="font-semibold text-slate-900">${(clearingCreditMember?.credit || 0).toFixed(2)}</span> credit from{' '}
              <span className="font-semibold text-slate-900">{clearingCreditMember?.name}</span>?
              <br /><br />
              This is useful for cleaning up bad records. Credits will be set to $0.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="text-lg px-6 py-3 h-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCredit} className="bg-amber-600 hover:bg-amber-700 text-lg px-6 py-3 h-auto">
              Clear Credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MemberDetailDialog
        member={selectedMember}
        members={members}
        bills={bills}
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        onBillClick={(bill) => {
          setSelectedMember(null);
          setViewingBill(bill);
        }}
      />

      <PaymentBreakdownDialog
        bill={viewingBill}
        members={members}
        open={!!viewingBill}
        onOpenChange={(open) => !open && setViewingBill(null)}
      />
    </div>
  );
}
