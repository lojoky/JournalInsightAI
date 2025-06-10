import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User, InsertUser } from "@shared/schema";

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateUser(username: string, password: string): Promise<AuthResult> {
  try {
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return { success: false, error: "Invalid username or password" };
    }

    const isValidPassword = await verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      return { success: false, error: "Invalid username or password" };
    }

    return { success: true, user };
  } catch (error) {
    console.error("Authentication error:", error);
    return { success: false, error: "Authentication failed" };
  }
}

export async function createUser(username: string, password: string): Promise<AuthResult> {
  try {
    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return { success: false, error: "Username already exists" };
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const newUser: InsertUser = {
      username,
      password: hashedPassword
    };

    const user = await storage.createUser(newUser);
    return { success: true, user };
  } catch (error) {
    console.error("User creation error:", error);
    return { success: false, error: "Failed to create user" };
  }
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters long" };
  }
  
  if (username.length > 50) {
    return { valid: false, error: "Username must be less than 50 characters" };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  }
  
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters long" };
  }
  
  if (password.length > 100) {
    return { valid: false, error: "Password must be less than 100 characters" };
  }
  
  return { valid: true };
}