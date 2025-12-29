/**
 * Migration script: Export data from Firebase and import to Vercel Postgres
 *
 * Usage:
 * 1. Make sure you have VITE_FIREBASE_* env vars set in .env
 * 2. Run: node scripts/migrate-to-postgres.mjs export
 *    This creates firebase-export.json with all your data
 * 3. Deploy to Vercel and create a Postgres database
 * 4. Run: node scripts/migrate-to-postgres.mjs import
 *    This imports the data to your Vercel Postgres database
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { config } from 'dotenv';

config();

const EXPORT_FILE = 'firebase-export.json';

// Firebase config from env
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

async function exportFromFirebase() {
  console.log('Connecting to Firebase...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const data = {
    members: [],
    bills: [],
    settlements: []
  };

  // Export members
  console.log('Exporting members...');
  const membersSnapshot = await getDocs(collection(db, 'members'));
  membersSnapshot.forEach((doc) => {
    const docData = doc.data();
    data.members.push({
      id: doc.id,
      name: docData.name,
      mortgageShare: docData.mortgageShare || 0,
      email: docData.email || null,
      avatarColor: docData.avatarColor || null,
      defaultSplitPercentage: docData.defaultSplitPercentage || null,
      credit: docData.credit || 0,
      venmoHandle: docData.venmoHandle || null,
    });
  });
  console.log(`  Found ${data.members.length} members`);

  // Export bills
  console.log('Exporting bills...');
  const billsSnapshot = await getDocs(collection(db, 'bills'));
  billsSnapshot.forEach((doc) => {
    const docData = doc.data();
    data.bills.push({
      id: doc.id,
      name: docData.name,
      amount: docData.amount,
      dueDate: docData.dueDate,
      category: docData.category,
      splitType: docData.splitType,
      paidBy: docData.paidBy || null,
      paidContributions: docData.paidContributions || null,
      contributionDates: docData.contributionDates || null,
      creditUsed: docData.creditUsed || null,
      creditEarned: docData.creditEarned || null,
      coverageAllocations: docData.coverageAllocations || null,
      paidDate: docData.paidDate || null,
      isPaid: docData.isPaid || false,
      status: docData.status || 'pending',
      recurring: docData.recurring || false,
      frequency: docData.frequency || 'once',
      customSplits: docData.customSplits || null,
      items: docData.items || null,
      notes: docData.notes || null,
      createdAt: docData.createdAt || new Date().toISOString(),
      updatedAt: docData.updatedAt || new Date().toISOString(),
    });
  });
  console.log(`  Found ${data.bills.length} bills`);

  // Export settlement records
  console.log('Exporting settlement records...');
  const settlementsSnapshot = await getDocs(collection(db, 'settlementRecords'));
  settlementsSnapshot.forEach((doc) => {
    const docData = doc.data();
    data.settlements.push({
      id: doc.id,
      fromId: docData.fromId,
      toId: docData.toId,
      amount: docData.amount,
      type: docData.type,
      note: docData.note || null,
      createdAt: docData.createdAt || new Date().toISOString(),
    });
  });
  console.log(`  Found ${data.settlements.length} settlement records`);

  // Write to file
  writeFileSync(EXPORT_FILE, JSON.stringify(data, null, 2));
  console.log(`\nExported to ${EXPORT_FILE}`);
  console.log('\nNext steps:');
  console.log('1. Deploy to Vercel');
  console.log('2. Create a Postgres database in Vercel dashboard');
  console.log('3. Run: node scripts/migrate-to-postgres.mjs import');
}

async function importToPostgres() {
  if (!existsSync(EXPORT_FILE)) {
    console.error(`Error: ${EXPORT_FILE} not found. Run 'export' first.`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(EXPORT_FILE, 'utf-8'));
  console.log('Data to import:');
  console.log(`  Members: ${data.members.length}`);
  console.log(`  Bills: ${data.bills.length}`);
  console.log(`  Settlements: ${data.settlements.length}`);

  // Get the deployed URL from Vercel
  const deployedUrl = process.env.VERCEL_URL || process.argv[3];
  if (!deployedUrl) {
    console.error('\nError: Please provide the deployed Vercel URL');
    console.error('Usage: node scripts/migrate-to-postgres.mjs import https://your-app.vercel.app');
    process.exit(1);
  }

  const baseUrl = deployedUrl.startsWith('http') ? deployedUrl : `https://${deployedUrl}`;
  console.log(`\nImporting to ${baseUrl}/api/migrate...`);

  const response = await fetch(`${baseUrl}/api/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Migration failed:', error);
    process.exit(1);
  }

  const result = await response.json();
  console.log('\nMigration successful!');
  console.log('Imported:');
  console.log(`  Members: ${result.imported.members}`);
  console.log(`  Bills: ${result.imported.bills}`);
  console.log(`  Settlements: ${result.imported.settlements}`);
}

// Main
const command = process.argv[2];

if (command === 'export') {
  exportFromFirebase().catch(console.error);
} else if (command === 'import') {
  importToPostgres().catch(console.error);
} else {
  console.log('Firebase to Vercel Postgres Migration');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/migrate-to-postgres.mjs export');
  console.log('    Export data from Firebase to firebase-export.json');
  console.log('');
  console.log('  node scripts/migrate-to-postgres.mjs import <vercel-url>');
  console.log('    Import data from firebase-export.json to Vercel Postgres');
  console.log('    Example: node scripts/migrate-to-postgres.mjs import https://household-bills.vercel.app');
}
