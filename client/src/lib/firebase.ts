import { initializeApp } from "firebase/app";
import { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithRedirect(auth, provider);
}

export function signOutFromGoogle() {
  return signOut(auth);
}

export async function handleAuthRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      // User signed in successfully
      const user = result.user;
      const token = await user.getIdToken();
      return { user, token };
    }
    return null;
  } catch (error) {
    console.error("Auth redirect error:", error);
    throw error;
  }
}