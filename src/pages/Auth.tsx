import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { EmailStep } from "@/components/auth/EmailStep";
import { EmailLinkStep } from "@/components/auth/EmailLinkStep";
import { SetPasswordStep } from "@/components/auth/SetPasswordStep";
import { PasswordStep } from "@/components/auth/PasswordStep";
import { NotApprovedStep } from "@/components/auth/NotApprovedStep";

const Auth: React.FC = () => {
  const { authStep, completeEmailLinkSignIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authStep === "authenticated") {
      navigate("/investor", { replace: true });
    }
  }, [authStep, navigate]);

  useEffect(() => {
    completeEmailLinkSignIn();
  }, [completeEmailLinkSignIn]);

  const renderStep = () => {
    switch (authStep) {
      case "email":
        return <EmailStep />;
      case "email-link":
        return <EmailLinkStep />;
      case "set-password":
        return <SetPasswordStep />;
      case "password":
        return <PasswordStep />;
      case "not-approved":
        return <NotApprovedStep />;
      default:
        return <EmailStep />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <AnimatePresence mode="wait">
        {renderStep()}
      </AnimatePresence>

      {/* Footer */}
      <div className="fixed bottom-4 text-center">
        <p className="text-muted-foreground text-xs">
          © 2024 GoAiMEX. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Auth;
