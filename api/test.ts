import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Simple test query
    const result = await sql`SELECT NOW() as time`;
    return res.status(200).json({
      success: true,
      time: result.rows[0].time,
      env: !!process.env.POSTGRES_URL
    });
  } catch (error) {
    return res.status(500).json({
      error: String(error),
      hasEnv: !!process.env.POSTGRES_URL
    });
  }
}
