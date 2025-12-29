import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getSettlements(res);
      case 'POST':
        return await createSettlement(req, res);
      case 'DELETE':
        return await deleteSettlement(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Settlements API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getSettlements(res: VercelResponse) {
  const { rows } = await sql`SELECT * FROM settlement_records ORDER BY created_at DESC`;
  return res.status(200).json(transformSettlements(rows));
}

async function createSettlement(req: VercelRequest, res: VercelResponse) {
  const { fromId, toId, amount, type, note } = req.body;

  const { rows } = await sql`
    INSERT INTO settlement_records (from_id, to_id, amount, type, note)
    VALUES (${fromId}, ${toId}, ${amount}, ${type}, ${note || null})
    RETURNING *
  `;

  return res.status(201).json(transformSettlements(rows)[0]);
}

async function deleteSettlement(req: VercelRequest, res: VercelResponse) {
  const { id, clearAll } = req.query;

  if (clearAll === 'true') {
    await sql`DELETE FROM settlement_records`;
    return res.status(200).json({ success: true });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Settlement ID required' });
  }

  await sql`DELETE FROM settlement_records WHERE id = ${id}`;
  return res.status(200).json({ success: true });
}

function transformSettlements(rows: Record<string, unknown>[]) {
  return rows.map(row => ({
    id: row.id as string,
    fromId: row.from_id as string,
    toId: row.to_id as string,
    amount: Number(row.amount),
    type: row.type as 'forgiven' | 'paid',
    note: row.note as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
  }));
}
