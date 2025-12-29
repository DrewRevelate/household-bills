import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

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

const CUTOFF_DATE = '2025-09-01';

async function deleteOldBills() {
  const billsRef = collection(db, 'bills');
  const snapshot = await getDocs(billsRef);

  let deletedCount = 0;
  let skippedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const dueDate = data.dueDate;

    if (dueDate < CUTOFF_DATE) {
      console.log(`Deleting: ${data.name} (due: ${dueDate})`);
      await deleteDoc(doc(db, 'bills', docSnap.id));
      deletedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\nDone! Deleted ${deletedCount} bills, kept ${skippedCount} bills.`);
  process.exit(0);
}

deleteOldBills().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
