import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDV3nvcU6Og6bnyIsl_SAnz-N1m2Z_MZ7w",
  authDomain: "lambert-family-e6687.firebaseapp.com",
  projectId: "lambert-family-e6687",
  storageBucket: "lambert-family-e6687.firebasestorage.app",
  messagingSenderId: "1016886137010",
  appId: "1:1016886137010:web:1d27dd63990354813239ab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetBills() {
  console.log('Fetching all bills...');
  const billsRef = collection(db, 'bills');
  const snapshot = await getDocs(billsRef);

  const bills = [];
  snapshot.forEach((docSnap) => {
    bills.push({ id: docSnap.id, ...docSnap.data() });
  });

  console.log(`Found ${bills.length} bills`);

  // Delete all bills
  console.log('Deleting all bills...');
  for (const bill of bills) {
    await deleteDoc(doc(db, 'bills', bill.id));
    console.log(`  Deleted: ${bill.name}`);
  }

  // Recreate bills without payment info
  console.log('Recreating bills without payment data...');
  const now = new Date().toISOString();

  for (const bill of bills) {
    const cleanBill = {
      name: bill.name,
      amount: bill.amount,
      dueDate: bill.dueDate,
      category: bill.category,
      splitType: bill.splitType,
      paidBy: null,
      paidDate: null,
      isPaid: false,
      status: 'pending',
      recurring: bill.recurring || false,
      frequency: bill.frequency || 'once',
      createdAt: bill.createdAt || now,
      updatedAt: now,
    };

    // Preserve optional fields if they exist
    if (bill.customSplits) cleanBill.customSplits = bill.customSplits;
    if (bill.items) cleanBill.items = bill.items;
    if (bill.notes) cleanBill.notes = bill.notes;

    await setDoc(doc(db, 'bills', bill.id), cleanBill);
    console.log(`  Recreated: ${bill.name}`);
  }

  console.log('Done! All bills reset to unpaid.');
  process.exit(0);
}

resetBills().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
