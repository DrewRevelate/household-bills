import { useState } from 'react';
import type { Person, AvatarColor } from '@/lib/types';
import { AVATAR_COLORS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Pencil, Trash2, Mail, Percent, Users, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MemberAvatar } from '@/components/MemberAvatar';

interface MembersManagerProps {
  members: Person[];
  onAdd: (member: Omit<Person, 'id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Person>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function MembersManager({ members, onAdd, onUpdate, onDelete }: MembersManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Person | null>(null);
  const [deletingMember, setDeletingMember] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [mortgageShare, setMortgageShare] = useState('');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>('indigo');
  const [email, setEmail] = useState('');
  const [defaultSplitPercentage, setDefaultSplitPercentage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalMortgageShares = members.reduce((sum, m) => sum + m.mortgageShare, 0);

  const openAddForm = () => {
    setEditingMember(null);
    setName('');
    setMortgageShare('');
    setAvatarColor('indigo');
    setEmail('');
    setDefaultSplitPercentage('');
    setFormOpen(true);
  };

  const openEditForm = (member: Person) => {
    setEditingMember(member);
    setName(member.name);
    setMortgageShare(member.mortgageShare.toString());
    setAvatarColor(member.avatarColor || 'indigo');
    setEmail(member.email || '');
    setDefaultSplitPercentage(member.defaultSplitPercentage?.toString() || '');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingMember(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const memberData = {
        name,
        mortgageShare: parseFloat(mortgageShare) || 0,
        avatarColor,
        email: email || undefined,
        defaultSplitPercentage: defaultSplitPercentage ? parseFloat(defaultSplitPercentage) : undefined,
      };

      if (editingMember) {
        await onUpdate(editingMember.id, memberData);
      } else {
        await onAdd(memberData);
      }
      closeForm();
    } catch (err) {
      console.error('Error saving member:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deletingMember) {
      await onDelete(deletingMember.id);
      setDeletingMember(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Total mortgage shares: <span className="font-semibold text-foreground">${totalMortgageShares.toFixed(0)}/mo</span>
        </p>
        <Button onClick={openAddForm} className="bg-[#e07a5f] hover:bg-[#d06a4f] text-white font-semibold shadow-lg rounded-xl px-5">
          <Plus className="w-5 h-5 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Members Grid */}
      {members.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {members.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl p-6 shadow-lg border-2 border-[#e9dcc9] hover:shadow-xl transition-all group"
              >
                <div className="flex items-start justify-between">
                  <MemberAvatar member={{ name: member.name, avatarColor: member.avatarColor }} size="lg" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditForm(member)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingMember(member)}
                        className="text-rose-600 focus:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4">
                  <h3 className="font-bold text-gray-900 text-xl">{member.name}</h3>
                  {member.email && (
                    <div className="flex items-center gap-2 mt-1.5 text-gray-600 text-sm">
                      <Mail className="w-4 h-4" />
                      <span>{member.email}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {member.defaultSplitPercentage !== undefined && (
                      <Badge className="bg-[#3d5a80] text-white font-semibold rounded-full px-3 py-1">
                        <Percent className="w-3 h-3 mr-1" />
                        {member.defaultSplitPercentage}% default
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#f5ebe0]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Home className="w-4 h-4" />
                      <span>Mortgage Share</span>
                    </div>
                    <span className="font-bold text-[#3d5a80] text-lg">${member.mortgageShare.toFixed(0)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-[#e9dcc9] shadow-lg">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-[#f5ebe0]">
            <Users className="w-10 h-10 text-[#81664b]" />
          </div>
          <h3 className="font-bold text-gray-900 text-xl">No family members yet</h3>
          <p className="text-gray-600 mt-2">Add members to start splitting bills</p>
          <Button
            onClick={openAddForm}
            className="mt-6 bg-[#e07a5f] hover:bg-[#d06a4f] text-white font-semibold shadow-lg rounded-xl px-6 py-5"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add First Member
          </Button>
        </div>
      )}

      {/* Summary Card */}
      {members.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-8 text-white shadow-xl bg-[#3d5a80]"
        >
          <h3 className="text-xl font-bold mb-6 text-[#f4a261]">Family Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-200 text-sm font-medium">Total Members</p>
              <p className="text-3xl font-bold mt-1">{members.length}</p>
            </div>
            <div>
              <p className="text-gray-200 text-sm font-medium">Monthly Mortgage</p>
              <p className="text-3xl font-bold mt-1">${totalMortgageShares.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-gray-200 text-sm font-medium">Average Share</p>
              <p className="text-3xl font-bold mt-1 text-[#f4a261]">
                ${(totalMortgageShares / members.length).toFixed(0)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Add/Edit Member Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingMember ? 'Edit Member' : 'Add Family Member'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Avatar Color</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setAvatarColor(color.value)}
                    className={`w-10 h-10 rounded-full ${color.class} transition-all ${
                      avatarColor === color.value
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mortgageShare">Monthly Mortgage Share ($)</Label>
              <Input
                id="mortgageShare"
                type="number"
                step="1"
                min="0"
                placeholder="e.g., 500"
                value={mortgageShare}
                onChange={(e) => setMortgageShare(e.target.value)}
              />
              <p className="text-xs text-gray-500">Used for mortgage-based bill splitting</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="percentage">Default Split % (Optional)</Label>
              <div className="relative">
                <Input
                  id="percentage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g., 50"
                  value={defaultSplitPercentage}
                  onChange={(e) => setDefaultSplitPercentage(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500">Set a default percentage for automatic bill splitting</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeForm} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#e07a5f] hover:bg-[#d06a4f] text-white"
              >
                {submitting ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Member'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingMember} onOpenChange={() => setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deletingMember?.name} from the family?
              Their share in existing bills will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
