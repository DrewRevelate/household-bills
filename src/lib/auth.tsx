import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithPhoneNumber,
  type User,
  type ConfirmationResult,
  type RecaptchaVerifier
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, setupRecaptcha } from './firebase';

// Allowed users configuration
// After users sign in for the first time, add their UIDs to the allowedUsers collection in Firestore
// Document ID = user's Firebase UID
// Document fields: { role: 'admin' | 'member', name: string, contact: string }
export const ALLOWED_CONTACTS: Record<string, { name: string; role: 'admin' | 'member' }> = {
  // Andrew (admin) - phone
  '6037551646': { name: 'Andrew', role: 'admin' },
  // Andrew (admin) - Google email
  'alambert221@gmail.com': { name: 'Andrew', role: 'admin' },
  // Mom - phone
  '6037590542': { name: 'Mom', role: 'member' },
  // Dad - email
  'billlambert856@gmail.com': { name: 'Dad', role: 'member' },
  // Steve - phone
  '6037597894': { name: 'Steve', role: 'member' },
};

interface AllowedUserData {
  role: 'admin' | 'member';
  name: string;
  contact: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAllowed: boolean;
  isAdmin: boolean;
  allowedUserData: AllowedUserData | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  // Phone auth
  sendVerificationCode: (phoneNumber: string) => Promise<boolean>;
  confirmVerificationCode: (code: string) => Promise<boolean>;
  phoneAuthError: string | null;
  phoneAuthLoading: boolean;
  clearPhoneAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedUserData, setAllowedUserData] = useState<AllowedUserData | null>(null);
  const [phoneAuthError, setPhoneAuthError] = useState<string | null>(null);
  const [phoneAuthLoading, setPhoneAuthLoading] = useState(false);

  // Store confirmation result for verification step
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Check if user is in allowed list
  const checkAllowedUser = async (currentUser: User) => {
    console.log('=== Auth Debug ===');
    console.log('User UID:', currentUser.uid);
    console.log('User email:', currentUser.email);
    console.log('User phone:', currentUser.phoneNumber);

    try {
      // Check Firestore allowedUsers collection
      const userDocRef = doc(db, 'allowedUsers', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data() as AllowedUserData;
        console.log('Found existing allowedUsers doc:', data);
        setAllowedUserData(data);
        setIsAllowed(true);
        setIsAdmin(data.role === 'admin');
        return;
      }

      console.log('No allowedUsers doc found, checking ALLOWED_CONTACTS...');

      // User not in Firestore - check if their contact is in ALLOWED_CONTACTS
      // This helps identify users who need to be added to the allowedUsers collection
      const phoneNumber = currentUser.phoneNumber?.replace(/^\+1/, '') || '';
      const email = currentUser.email || '';

      console.log('Normalized phone:', phoneNumber);
      console.log('Email:', email);
      console.log('ALLOWED_CONTACTS keys:', Object.keys(ALLOWED_CONTACTS));

      const matchedContact = ALLOWED_CONTACTS[phoneNumber] || ALLOWED_CONTACTS[email];
      console.log('Matched contact:', matchedContact);

      if (matchedContact) {
        // User's contact is allowed but they're not in Firestore yet
        // Auto-create their allowedUsers document
        const userData: AllowedUserData = {
          role: matchedContact.role,
          name: matchedContact.name,
          contact: phoneNumber || email,
        };

        try {
          // Create the document in Firestore
          console.log('Creating allowedUsers doc for:', currentUser.uid);
          await setDoc(doc(db, 'allowedUsers', currentUser.uid), userData);
          console.log(`Auto-registered ${matchedContact.name} (${currentUser.uid}) as ${matchedContact.role}`);

          // Only grant access if Firestore write succeeded
          setAllowedUserData(userData);
          setIsAllowed(true);
          setIsAdmin(matchedContact.role === 'admin');
        } catch (err) {
          console.error('Failed to auto-register user:', err);
          // Firestore write failed - deny access
          setIsAllowed(false);
          setIsAdmin(false);
          setAllowedUserData(null);
        }
      } else {
        // User not allowed
        console.log('User not in ALLOWED_CONTACTS, denying access');
        setIsAllowed(false);
        setIsAdmin(false);
        setAllowedUserData(null);
      }
    } catch (error) {
      console.error('Error checking allowed user:', error);
      setIsAllowed(false);
      setIsAdmin(false);
      setAllowedUserData(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await checkAllowedUser(currentUser);
      } else {
        setIsAllowed(false);
        setIsAdmin(false);
        setAllowedUserData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const clearPhoneAuthError = () => {
    setPhoneAuthError(null);
  };

  const sendVerificationCode = async (phoneNumber: string): Promise<boolean> => {
    setPhoneAuthLoading(true);
    setPhoneAuthError(null);

    try {
      // Format phone number if needed (ensure it has country code)
      const formattedNumber = phoneNumber.startsWith('+')
        ? phoneNumber
        : `+1${phoneNumber.replace(/\D/g, '')}`;

      // Setup reCAPTCHA if not already done
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = setupRecaptcha('phone-sign-in-button');
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedNumber,
        recaptchaVerifierRef.current
      );

      confirmationResultRef.current = confirmationResult;
      setPhoneAuthLoading(false);
      return true;
    } catch (error) {
      console.error('Phone auth error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send verification code';

      // Provide user-friendly error messages
      if (errorMessage.includes('invalid-phone-number')) {
        setPhoneAuthError('Invalid phone number. Please include country code (e.g., +1 for US).');
      } else if (errorMessage.includes('too-many-requests')) {
        setPhoneAuthError('Too many attempts. Please try again later.');
      } else if (errorMessage.includes('quota-exceeded')) {
        setPhoneAuthError('SMS quota exceeded. Please try again later.');
      } else {
        setPhoneAuthError(errorMessage);
      }

      // Reset reCAPTCHA on error
      recaptchaVerifierRef.current = null;
      setPhoneAuthLoading(false);
      return false;
    }
  };

  const confirmVerificationCode = async (code: string): Promise<boolean> => {
    setPhoneAuthLoading(true);
    setPhoneAuthError(null);

    try {
      if (!confirmationResultRef.current) {
        throw new Error('No verification in progress. Please request a new code.');
      }

      await confirmationResultRef.current.confirm(code);

      // Clear refs on success
      confirmationResultRef.current = null;
      recaptchaVerifierRef.current = null;
      setPhoneAuthLoading(false);
      return true;
    } catch (error) {
      console.error('Code verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify code';

      if (errorMessage.includes('invalid-verification-code')) {
        setPhoneAuthError('Invalid code. Please check and try again.');
      } else if (errorMessage.includes('code-expired')) {
        setPhoneAuthError('Code expired. Please request a new one.');
      } else {
        setPhoneAuthError(errorMessage);
      }

      setPhoneAuthLoading(false);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAllowed,
      isAdmin,
      allowedUserData,
      signInWithGoogle,
      signOut,
      sendVerificationCode,
      confirmVerificationCode,
      phoneAuthError,
      phoneAuthLoading,
      clearPhoneAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
