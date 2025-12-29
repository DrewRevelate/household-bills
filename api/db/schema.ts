import { sql } from '@vercel/postgres';

export async function initializeDatabase() {
  // Create members table
  await sql`
    CREATE TABLE IF NOT EXISTS members (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      mortgage_share DECIMAL(10,2) DEFAULT 0,
      email VARCHAR(255),
      avatar_color VARCHAR(20),
      default_split_percentage DECIMAL(5,2),
      credit DECIMAL(10,2) DEFAULT 0,
      venmo_handle VARCHAR(50)
    )
  `;

  // Create bills table
  await sql`
    CREATE TABLE IF NOT EXISTS bills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      due_date DATE NOT NULL,
      category VARCHAR(50) NOT NULL,
      split_type VARCHAR(20) NOT NULL,
      paid_by VARCHAR(50),
      paid_contributions JSONB,
      contribution_dates JSONB,
      credit_used JSONB,
      credit_earned JSONB,
      coverage_allocations JSONB,
      paid_date DATE,
      is_paid BOOLEAN DEFAULT FALSE,
      status VARCHAR(20) DEFAULT 'pending',
      recurring BOOLEAN DEFAULT FALSE,
      frequency VARCHAR(20) DEFAULT 'once',
      custom_splits JSONB,
      items JSONB,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Create settlement_records table
  await sql`
    CREATE TABLE IF NOT EXISTS settlement_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_id VARCHAR(50) NOT NULL,
      to_id VARCHAR(50) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      type VARCHAR(20) NOT NULL,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // Create index for faster queries
  await sql`CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_settlement_records_created ON settlement_records(created_at DESC)`;

  return { success: true };
}
