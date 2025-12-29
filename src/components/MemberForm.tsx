import { useState, useEffect } from 'react';
import type { Person, AvatarColor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const avatarColors = [
  { value: 'bg-indigo-500', label: 'Indigo' },
  { value: 'bg-emerald-500', label: 'Emerald' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-violet-500', label: 'Violet' },
  { value: 'bg-cyan-500', label: 'Cyan' },
  { value: 'bg-pink-500', label: 'Pink' },
  { value: 'bg-teal-500', label: 'Teal' },
];

interface MemberFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Person, 'id'>) => Promise<void>;
  member?: Person | null;
}

export function MemberForm({ open, onClose, onSubmit, member = null }: MemberFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    venmoHandle: '',
    avatarColor: 'bg-indigo-500',
    mortgageShare: '',
    defaultSplitPercentage: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || '',
        email: member.email || '',
        venmoHandle: member.venmoHandle || '',
        avatarColor: member.avatarColor ? `bg-${member.avatarColor}-500` : 'bg-indigo-500',
        mortgageShare: member.mortgageShare?.toString() || '',
        defaultSplitPercentage: member.defaultSplitPercentage?.toString() || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        venmoHandle: '',
        avatarColor: 'bg-indigo-500',
        mortgageShare: '',
        defaultSplitPercentage: '',
      });
    }
  }, [member, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Extract color name from class (e.g., 'bg-indigo-500' -> 'indigo')
      const colorName = formData.avatarColor.replace('bg-', '').replace('-500', '') as AvatarColor;
      const venmoHandle = formData.venmoHandle.trim().replace(/^@/, '');

      await onSubmit({
        name: formData.name,
        email: formData.email || undefined,
        venmoHandle,
        avatarColor: colorName,
        mortgageShare: parseFloat(formData.mortgageShare) || 0,
        defaultSplitPercentage: formData.defaultSplitPercentage
          ? parseFloat(formData.defaultSplitPercentage)
          : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Error submitting member:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {member ? 'Edit Member' : 'Add Family Member'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {member ? 'Edit the details of a family member' : 'Add a new family member to split bills with'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g., John Smith"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venmoHandle">Venmo Username (Optional)</Label>
            <Input
              id="venmoHandle"
              placeholder="@username"
              value={formData.venmoHandle}
              onChange={(e) => setFormData({ ...formData, venmoHandle: e.target.value })}
            />
            <p className="text-xs text-gray-500">Used to open Venmo directly with their handle filled in.</p>
          </div>

          <div className="space-y-2">
            <Label>Avatar Color</Label>
            <div className="flex flex-wrap gap-2">
              {avatarColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatarColor: color.value })}
                  className={`w-10 h-10 rounded-full ${color.value} transition-all ${
                    formData.avatarColor === color.value
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
              min="0"
              placeholder="e.g., 500"
              value={formData.mortgageShare}
              onChange={(e) => setFormData({ ...formData, mortgageShare: e.target.value })}
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
                value={formData.defaultSplitPercentage}
                onChange={(e) => setFormData({ ...formData, defaultSplitPercentage: e.target.value })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500">Set a default percentage for automatic bill splitting</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting ? 'Saving...' : member ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
