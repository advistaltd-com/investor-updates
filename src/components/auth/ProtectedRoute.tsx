import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { authStep, user, isReady } = useAuth();

  if (!isReady) {
    return null;
  }

  if (authStep !== "authenticated" || !user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
