import * as admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

// Initialize Firebase Admin SDK
let firebaseAdmin: admin.app.App | null = null;

export function initializeFirebaseAdmin() {
  if (!process.env.VITE_FIREBASE_PROJECT_ID) {
    console.log('Firebase project ID not found, skipping Firebase Admin initialization');
    return false;
  }

  try {
    firebaseAdmin = admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    });
    console.log('Firebase Admin initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return false;
  }
}

export async function verifyFirebaseToken(idToken: string) {
  if (!firebaseAdmin) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    throw error;
  }
}

export const authenticateFirebase = async (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Let other auth methods handle this
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyFirebaseToken(idToken);
    
    // Create user object compatible with existing auth system
    req.user = {
      claims: {
        sub: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
      }
    };
    
    next();
  } catch (error) {
    console.error('Firebase authentication error:', error);
    return next(); // Let other auth methods handle this
  }
};