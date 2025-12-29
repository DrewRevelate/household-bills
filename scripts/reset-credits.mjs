import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

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

async function resetCredits() {
  console.log('Fetching all members...');
  const membersRef = collection(db, 'members');
  const snapshot = await getDocs(membersRef);

  console.log(`Found ${snapshot.size} members`);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.credit && data.credit > 0) {
      console.log(`  Resetting ${data.name}'s credit from $${data.credit.toFixed(2)} to $0`);
      await updateDoc(doc(db, 'members', docSnap.id), { credit: 0 });
    }
  }

  console.log('Done! All member credits reset to $0.');
  process.exit(0);
}

resetCredits().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
