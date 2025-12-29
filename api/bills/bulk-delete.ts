import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { cutoffDate } = req.body;

    if (!cutoffDate) {
      return res.status(400).json({ error: 'cutoffDate required' });
    }

    const { rowCount } = await sql`
      DELETE FROM bills WHERE due_date < ${cutoffDate}
    `;

    return res.status(200).json({ deleted: rowCount });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
