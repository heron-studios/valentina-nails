import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAFSlu0pykUrn9z3zA86GrNz0ji_qi8EX8',
  authDomain: 'valentina-nails-2026.firebaseapp.com',
  projectId: 'valentina-nails-2026',
  storageBucket: 'valentina-nails-2026.firebasestorage.app',
  messagingSenderId: '845415398880',
  appId: '1:845415398880:web:dac73da3eb86cd1a7bff85',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
