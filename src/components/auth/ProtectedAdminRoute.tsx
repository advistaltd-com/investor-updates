import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { authStep, user, isAdmin, isReady } = useAuth();

  if (!isReady) return null;

  if (authStep !== "authenticated" || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/investor" replace />;
  }

  return <>{children}</>;
};
