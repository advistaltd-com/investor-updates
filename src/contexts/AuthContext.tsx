import React, { createContext, useContext, useState, useCallback } from "react";

export type AuthStep = 
  | "email" 
  | "otp" 
  | "set-password" 
  | "password" 
  | "not-approved" 
  | "authenticated";

export interface User {
  email: string;
  isNewUser: boolean;
}

interface AuthContextType {
  user: User | null;
  authStep: AuthStep;
  email: string;
  isLoading: boolean;
  error: string | null;
  setEmail: (email: string) => void;
  setAuthStep: (step: AuthStep) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  checkEmailApproval: (email: string) => Promise<{ approved: boolean; isNewUser: boolean }>;
  sendOtp: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
  setPassword: (email: string, password: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock data - will be replaced with Firebase/Netlify Functions
const MOCK_APPROVED_DOMAINS = ["goaimex.com", "investor.vc", "capitalfirm.com"];
const MOCK_APPROVED_EMAILS = ["demo@example.com", "investor@test.com"];
const MOCK_EXISTING_USERS = ["demo@example.com"]; // Users who already have accounts

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEmailApproval = useCallback(async (emailToCheck: string): Promise<{ approved: boolean; isNewUser: boolean }> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const normalizedEmail = emailToCheck.toLowerCase().trim();
    const domain = normalizedEmail.split("@")[1];
    
    const isApproved = MOCK_APPROVED_EMAILS.includes(normalizedEmail) || 
                       MOCK_APPROVED_DOMAINS.includes(domain);
    const isNewUser = !MOCK_EXISTING_USERS.includes(normalizedEmail);
    
    return { approved: isApproved, isNewUser };
  }, []);

  const sendOtp = useCallback(async (emailToSend: string): Promise<boolean> => {
    // Simulate sending OTP via Resend
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`[Mock] OTP sent to ${emailToSend}`);
    return true;
  }, []);

  const verifyOtp = useCallback(async (_email: string, otp: string): Promise<boolean> => {
    // Simulate OTP verification - accept "123456" for demo
    await new Promise(resolve => setTimeout(resolve, 800));
    return otp === "123456";
  }, []);

  const setPassword = useCallback(async (emailToSet: string, _password: string): Promise<boolean> => {
    // Simulate creating user account
    await new Promise(resolve => setTimeout(resolve, 1000));
    setUser({ email: emailToSet, isNewUser: true });
    setAuthStep("authenticated");
    return true;
  }, []);

  const login = useCallback(async (emailToLogin: string, password: string): Promise<boolean> => {
    // Simulate login - accept "password123" for demo
    await new Promise(resolve => setTimeout(resolve, 800));
    if (password === "password123") {
      setUser({ email: emailToLogin, isNewUser: false });
      setAuthStep("authenticated");
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAuthStep("email");
    setEmail("");
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authStep,
        email,
        isLoading,
        error,
        setEmail,
        setAuthStep,
        setError,
        setIsLoading,
        checkEmailApproval,
        sendOtp,
        verifyOtp,
        setPassword,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
