import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getFunctionUrl } from "@/lib/functions";

export type AuthStep =
  | "email"
  | "email-link"
  | "set-password"
  | "password"
  | "not-approved"
  | "authenticated";

export interface User {
  email: string;
  uid: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isAdmin: boolean;
  authStep: AuthStep;
  email: string;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  setEmail: (email: string) => void;
  setAuthStep: (step: AuthStep) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  checkEmailApproval: (email: string) => Promise<{ approved: boolean; isExistingUser: boolean }>;
  sendEmailLink: (email: string) => Promise<boolean>;
  completeEmailLinkSignIn: () => Promise<{ handled: boolean; isNewUser: boolean }>;
  setPassword: (password: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "emailForSignIn";

const getEmailLinkRedirect = () =>
  import.meta.env.VITE_EMAIL_LINK_REDIRECT_URL || `${window.location.origin}/auth`;

const parseErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setFirebaseUser(currentUser);
        setUser({ email: currentUser.email || "", uid: currentUser.uid });
        if (!needsPasswordSetup) {
          setAuthStep("authenticated");
        } else {
          setAuthStep("set-password");
        }
        
        // Check Firestore for admin status
        const email = currentUser.email?.toLowerCase();
        if (email) {
          try {
            const adminDoc = await getDoc(doc(db, "admins", email));
            setIsAdmin(adminDoc.exists());
          } catch (err) {
            console.error("Error checking admin status:", err);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        setIsAdmin(false);
        setAuthStep("email");
        setNeedsPasswordSetup(false);
      }
      setIsReady(true);
    });

    return () => unsubscribe();
  }, [needsPasswordSetup]);

  const checkEmailApproval = useCallback(
    async (emailToCheck: string): Promise<{ approved: boolean; isExistingUser: boolean }> => {
      try {
        const response = await fetch(getFunctionUrl("check-allowlist"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailToCheck.toLowerCase().trim() }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Unable to verify access. Please try again.");
        }

        return response.json();
      } catch (err) {
        // Re-throw with more context for network errors
        if (err instanceof TypeError && err.message.includes("fetch")) {
          throw new Error("Network error: Unable to connect to server. Make sure Netlify Dev is running (netlify dev).");
        }
        throw err;
      }
    },
  );

  const sendEmailLink = useCallback(async (emailToSend: string): Promise<boolean> => {
    const actionCodeSettings = {
      url: getEmailLinkRedirect(),
      handleCodeInApp: true,
    };

    await sendSignInLinkToEmail(auth, emailToSend, actionCodeSettings);
    window.localStorage.setItem(STORAGE_KEY, emailToSend);
    return true;
  }, []);

  const syncUserRecord = useCallback(async () => {
    if (!auth.currentUser) return;

    const token = await auth.currentUser.getIdToken();
    const response = await fetch(getFunctionUrl("create-user"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Unable to sync user profile.");
    }
  }, []);

  const completeEmailLinkSignIn = useCallback(async () => {
    if (typeof window === "undefined") {
      return { handled: false, isNewUser: false };
    }

    if (!isSignInWithEmailLink(auth, window.location.href)) {
      return { handled: false, isNewUser: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const storedEmail = window.localStorage.getItem(STORAGE_KEY);
      if (!storedEmail) {
        throw new Error("We could not verify your sign-in email. Please restart.");
      }

      const result = await signInWithEmailLink(auth, storedEmail, window.location.href);
      window.localStorage.removeItem(STORAGE_KEY);
      setEmail(storedEmail);

      await syncUserRecord();

      const isNewUser = Boolean(result.additionalUserInfo?.isNewUser);
      setNeedsPasswordSetup(isNewUser);
      setAuthStep(isNewUser ? "set-password" : "authenticated");
      return { handled: true, isNewUser };
    } catch (err) {
      setError(parseErrorMessage(err));
      setAuthStep("email");
      return { handled: true, isNewUser: false };
    } finally {
      setIsLoading(false);
    }
  }, [syncUserRecord]);

  const setPassword = useCallback(async (password: string): Promise<boolean> => {
    if (!auth.currentUser) {
      setError("No active session found. Please sign in again.");
      return false;
    }

    await updatePassword(auth.currentUser, password);
    setNeedsPasswordSetup(false);
    setAuthStep("authenticated");
    return true;
  }, []);

  const sendPasswordReset = useCallback(async (emailToReset: string): Promise<boolean> => {
    const trimmedEmail = emailToReset.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter a valid email to reset your password.");
      return false;
    }

    const actionCodeSettings = {
      url: getEmailLinkRedirect(),
      handleCodeInApp: false,
    };

    await sendPasswordResetEmail(auth, trimmedEmail, actionCodeSettings);
    return true;
  }, []);

  const login = useCallback(async (emailToLogin: string, password: string): Promise<boolean> => {
    await signInWithEmailAndPassword(auth, emailToLogin, password);
    await syncUserRecord();
    setAuthStep("authenticated");
    return true;
  }, [syncUserRecord]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setAuthStep("email");
    setEmail("");
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      isAdmin,
      authStep,
      email,
      isLoading,
      isReady,
      error,
      setEmail,
      setAuthStep,
      setError,
      setIsLoading,
      checkEmailApproval,
      sendEmailLink,
      completeEmailLinkSignIn,
      setPassword,
      sendPasswordReset,
      login,
      logout,
    }),
    [
      user,
      firebaseUser,
      isAdmin,
      authStep,
      email,
      isLoading,
      isReady,
      error,
      checkEmailApproval,
      sendEmailLink,
      completeEmailLinkSignIn,
      setPassword,
      sendPasswordReset,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
