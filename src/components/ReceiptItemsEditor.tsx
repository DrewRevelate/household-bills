import { useState } from 'react';
import type { ReceiptItem, Person } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReceiptItemsEditorProps {
  items: ReceiptItem[];
  members: Person[];
  onChange: (items: ReceiptItem[]) => void;
}

export function ReceiptItemsEditor({ items, members, onChange }: ReceiptItemsEditorProps) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addItem = () => {
    if (!newItemName.trim() || !newItemAmount) return;

    const newItem: ReceiptItem = {
      id: generateId(),
      name: newItemName.trim(),
      amount: parseFloat(newItemAmount) || 0,
      assignedTo: members.map((m) => m.id), // Default: assign to all
    };

    onChange([...items, newItem]);
    setNewItemName('');
    setNewItemAmount('');
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ReceiptItem>) => {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const toggleAssignment = (itemId: string, personId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const newAssigned = item.assignedTo.includes(personId)
      ? item.assignedTo.filter((id) => id !== personId)
      : [...item.assignedTo, personId];

    updateItem(itemId, { assignedTo: newAssigned });
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const getPersonShare = (personId: string) => {
    return items.reduce((sum, item) => {
      if (item.assignedTo.includes(personId) && item.assignedTo.length > 0) {
        return sum + item.amount / item.assignedTo.length;
      }
      return sum;
    }, 0);
  };

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Receipt Items</span>
        </div>
        <span className="text-sm text-muted-foreground">
          Total: ${totalAmount.toFixed(2)}
        </span>
      </div>

      {/* Add new item */}
      <div className="flex gap-2">
        <Input
          placeholder="Item name"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="flex-1 h-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="$"
          value={newItemAmount}
          onChange={(e) => setNewItemAmount(e.target.value)}
          className="w-20 h-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button type="button" size="sm" onClick={addItem} className="h-9">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg bg-zinc-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  className="flex-1 h-8 text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.amount}
                  onChange={(e) => updateItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                  className="w-20 h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Assignment checkboxes */}
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors',
                      item.assignedTo.includes(member.id)
                        ? 'bg-zinc-200 text-zinc-800'
                        : 'bg-zinc-100 text-zinc-500'
                    )}
                  >
                    <Checkbox
                      checked={item.assignedTo.includes(member.id)}
                      onCheckedChange={() => toggleAssignment(item.id, member.id)}
                      className="h-3 w-3"
                    />
                    {member.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          Add items to split individually among members
        </p>
      )}

      {/* Per-person breakdown */}
      {items.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Per-person breakdown:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {members.map((member) => {
              const share = getPersonShare(member.id);
              return (
                <div key={member.id} className="flex justify-between">
                  <span>{member.name}</span>
                  <span className="font-medium">${share.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
