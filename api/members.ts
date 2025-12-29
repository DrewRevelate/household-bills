import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Default household members for initialization
const DEFAULT_MEMBERS = [
  { id: 'drew', name: 'Drew', mortgage_share: 1300 },
  { id: 'steve', name: 'Steve', mortgage_share: 700 },
  { id: 'mom', name: 'Mom', mortgage_share: 500 },
  { id: 'dad', name: 'Dad', mortgage_share: 500 },
  { id: 'rose', name: 'Rose', mortgage_share: 500 },
];

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
        return await getMembers(res);
      case 'POST':
        return await createMember(req, res);
      case 'PUT':
        return await updateMember(req, res);
      case 'DELETE':
        return await deleteMember(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Members API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMembers(res: VercelResponse) {
  const { rows } = await sql`SELECT * FROM members ORDER BY name ASC`;

  // Initialize with defaults if empty
  if (rows.length === 0) {
    for (const member of DEFAULT_MEMBERS) {
      await sql`
        INSERT INTO members (id, name, mortgage_share)
        VALUES (${member.id}, ${member.name}, ${member.mortgage_share})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    const { rows: newRows } = await sql`SELECT * FROM members ORDER BY name ASC`;
    return res.status(200).json(transformMembers(newRows));
  }

  return res.status(200).json(transformMembers(rows));
}

async function createMember(req: VercelRequest, res: VercelResponse) {
  const { name, mortgageShare, email, avatarColor, defaultSplitPercentage, venmoHandle } = req.body;
  const id = name.toLowerCase().replace(/\s+/g, '-');

  await sql`
    INSERT INTO members (id, name, mortgage_share, email, avatar_color, default_split_percentage, venmo_handle)
    VALUES (${id}, ${name}, ${mortgageShare || 0}, ${email || null}, ${avatarColor || null}, ${defaultSplitPercentage || null}, ${venmoHandle || null})
  `;

  return res.status(201).json({ id, name, mortgageShare: mortgageShare || 0 });
}

async function updateMember(req: VercelRequest, res: VercelResponse) {
  const { id, ...updates } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Member ID required' });
  }

  const setClauses = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    values.push(updates.name);
    setClauses.push(`name = $${values.length}`);
  }
  if (updates.mortgageShare !== undefined) {
    values.push(updates.mortgageShare);
    setClauses.push(`mortgage_share = $${values.length}`);
  }
  if (updates.email !== undefined) {
    values.push(updates.email);
    setClauses.push(`email = $${values.length}`);
  }
  if (updates.avatarColor !== undefined) {
    values.push(updates.avatarColor);
    setClauses.push(`avatar_color = $${values.length}`);
  }
  if (updates.defaultSplitPercentage !== undefined) {
    values.push(updates.defaultSplitPercentage);
    setClauses.push(`default_split_percentage = $${values.length}`);
  }
  if (updates.credit !== undefined) {
    values.push(updates.credit);
    setClauses.push(`credit = $${values.length}`);
  }
  if (updates.venmoHandle !== undefined) {
    values.push(updates.venmoHandle);
    setClauses.push(`venmo_handle = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);
  const query = `UPDATE members SET ${setClauses.join(', ')} WHERE id = $${values.length}`;
  await sql.query(query, values);

  return res.status(200).json({ success: true });
}

async function deleteMember(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Member ID required' });
  }

  await sql`DELETE FROM members WHERE id = ${id}`;
  return res.status(200).json({ success: true });
}

function transformMembers(rows: Record<string, unknown>[]) {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    mortgageShare: Number(row.mortgage_share) || 0,
    email: row.email || undefined,
    avatarColor: row.avatar_color || undefined,
    defaultSplitPercentage: row.default_split_percentage ? Number(row.default_split_percentage) : undefined,
    credit: Number(row.credit) || 0,
    venmoHandle: row.venmo_handle || undefined,
  }));
}
