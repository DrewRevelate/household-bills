import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Migration endpoint to import data from Firebase export
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
    const { members, bills, settlements } = req.body;
    let membersImported = 0;
    let billsImported = 0;
    let settlementsImported = 0;

    // Import members
    if (members && Array.isArray(members)) {
      for (const member of members) {
        await sql`
          INSERT INTO members (id, name, mortgage_share, email, avatar_color, default_split_percentage, credit, venmo_handle)
          VALUES (
            ${member.id},
            ${member.name},
            ${member.mortgageShare || 0},
            ${member.email || null},
            ${member.avatarColor || null},
            ${member.defaultSplitPercentage || null},
            ${member.credit || 0},
            ${member.venmoHandle || null}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            mortgage_share = EXCLUDED.mortgage_share,
            email = EXCLUDED.email,
            avatar_color = EXCLUDED.avatar_color,
            default_split_percentage = EXCLUDED.default_split_percentage,
            credit = EXCLUDED.credit,
            venmo_handle = EXCLUDED.venmo_handle
        `;
        membersImported++;
      }
    }

    // Import bills (generate new UUIDs since Firebase IDs aren't UUIDs)
    if (bills && Array.isArray(bills)) {
      for (const bill of bills) {
        await sql`
          INSERT INTO bills (
            name, amount, due_date, category, split_type, paid_by,
            paid_contributions, contribution_dates, credit_used, credit_earned,
            coverage_allocations, paid_date, is_paid, status, recurring, frequency,
            custom_splits, items, notes, created_at, updated_at
          )
          VALUES (
            ${bill.name},
            ${bill.amount},
            ${bill.dueDate},
            ${bill.category},
            ${bill.splitType},
            ${bill.paidBy || null},
            ${bill.paidContributions ? JSON.stringify(bill.paidContributions) : null},
            ${bill.contributionDates ? JSON.stringify(bill.contributionDates) : null},
            ${bill.creditUsed ? JSON.stringify(bill.creditUsed) : null},
            ${bill.creditEarned ? JSON.stringify(bill.creditEarned) : null},
            ${bill.coverageAllocations ? JSON.stringify(bill.coverageAllocations) : null},
            ${bill.paidDate || null},
            ${bill.isPaid || false},
            ${bill.status || 'pending'},
            ${bill.recurring || false},
            ${bill.frequency || 'once'},
            ${bill.customSplits ? JSON.stringify(bill.customSplits) : null},
            ${bill.items ? JSON.stringify(bill.items) : null},
            ${bill.notes || null},
            ${bill.createdAt || new Date().toISOString()},
            ${bill.updatedAt || new Date().toISOString()}
          )
        `;
        billsImported++;
      }
    }

    // Import settlement records (generate new UUIDs)
    if (settlements && Array.isArray(settlements)) {
      for (const record of settlements) {
        await sql`
          INSERT INTO settlement_records (from_id, to_id, amount, type, note, created_at)
          VALUES (
            ${record.fromId},
            ${record.toId},
            ${record.amount},
            ${record.type},
            ${record.note || null},
            ${record.createdAt || new Date().toISOString()}
          )
        `;
        settlementsImported++;
      }
    }

    return res.status(200).json({
      success: true,
      imported: {
        members: membersImported,
        bills: billsImported,
        settlements: settlementsImported,
      },
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: 'Migration failed', details: String(error) });
  }
}
