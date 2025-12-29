import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getBills(res);
      case 'POST':
        return await createBill(req, res);
      case 'PUT':
        return await updateBill(req, res);
      case 'DELETE':
        return await deleteBill(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Bills API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getBills(res: VercelResponse) {
  const { rows } = await sql`SELECT * FROM bills ORDER BY due_date DESC`;
  return res.status(200).json(transformBills(rows));
}

async function createBill(req: VercelRequest, res: VercelResponse) {
  const {
    name,
    amount,
    dueDate,
    category,
    splitType,
    paidBy,
    paidContributions,
    contributionDates,
    creditUsed,
    creditEarned,
    coverageAllocations,
    paidDate,
    isPaid,
    recurring,
    frequency,
    customSplits,
    items,
    notes,
  } = req.body;

  const { rows } = await sql`
    INSERT INTO bills (
      name, amount, due_date, category, split_type, paid_by,
      paid_contributions, contribution_dates, credit_used, credit_earned,
      coverage_allocations, paid_date, is_paid, recurring, frequency,
      custom_splits, items, notes
    )
    VALUES (
      ${name}, ${amount}, ${dueDate}, ${category}, ${splitType}, ${paidBy || null},
      ${paidContributions ? JSON.stringify(paidContributions) : null},
      ${contributionDates ? JSON.stringify(contributionDates) : null},
      ${creditUsed ? JSON.stringify(creditUsed) : null},
      ${creditEarned ? JSON.stringify(creditEarned) : null},
      ${coverageAllocations ? JSON.stringify(coverageAllocations) : null},
      ${paidDate || null}, ${isPaid || false}, ${recurring || false}, ${frequency || 'once'},
      ${customSplits ? JSON.stringify(customSplits) : null},
      ${items ? JSON.stringify(items) : null},
      ${notes || null}
    )
    RETURNING *
  `;

  return res.status(201).json(transformBills(rows)[0]);
}

async function updateBill(req: VercelRequest, res: VercelResponse) {
  const { id, ...updates } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Bill ID required' });
  }

  const setClauses = [];
  const values: (string | number | boolean | null)[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    amount: 'amount',
    dueDate: 'due_date',
    category: 'category',
    splitType: 'split_type',
    paidBy: 'paid_by',
    paidContributions: 'paid_contributions',
    contributionDates: 'contribution_dates',
    creditUsed: 'credit_used',
    creditEarned: 'credit_earned',
    coverageAllocations: 'coverage_allocations',
    paidDate: 'paid_date',
    isPaid: 'is_paid',
    status: 'status',
    recurring: 'recurring',
    frequency: 'frequency',
    customSplits: 'custom_splits',
    items: 'items',
    notes: 'notes',
  };

  const jsonFields = ['paidContributions', 'contributionDates', 'creditUsed', 'creditEarned', 'coverageAllocations', 'customSplits', 'items'];

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      let value = updates[key];
      if (jsonFields.includes(key)) {
        value = value === null ? null : JSON.stringify(value);
      }
      values.push(value);
      setClauses.push(`${dbField} = $${values.length}`);
    }
  }

  // Always update updated_at
  setClauses.push('updated_at = NOW()');

  if (setClauses.length === 1) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);
  const query = `UPDATE bills SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`;
  const { rows } = await sql.query(query, values);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Bill not found' });
  }

  return res.status(200).json(transformBills(rows)[0]);
}

async function deleteBill(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Bill ID required' });
  }

  await sql`DELETE FROM bills WHERE id = ${id}`;
  return res.status(200).json({ success: true });
}

function transformBills(rows: Record<string, unknown>[]) {
  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    amount: Number(row.amount),
    dueDate: formatDate(row.due_date as string),
    category: row.category as string,
    splitType: row.split_type as string,
    paidBy: row.paid_by as string | null,
    paidContributions: row.paid_contributions as Record<string, number> | null,
    contributionDates: row.contribution_dates as Record<string, string> | null,
    creditUsed: row.credit_used as Record<string, number> | null,
    creditEarned: row.credit_earned as Record<string, number> | null,
    coverageAllocations: row.coverage_allocations as { payerId: string; coveredId: string; amount: number }[] | null,
    paidDate: row.paid_date ? formatDate(row.paid_date as string) : null,
    isPaid: row.is_paid as boolean,
    status: row.status as string,
    recurring: row.recurring as boolean,
    frequency: row.frequency as string,
    customSplits: row.custom_splits as Record<string, number> | null,
    items: row.items as { id: string; name: string; amount: number; assignedTo: string[] }[] | null,
    notes: row.notes as string | null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  }));
}

function formatDate(date: string | Date): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  return date.toISOString().split('T')[0];
}
