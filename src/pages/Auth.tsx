import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EmailStep } from "@/components/auth/EmailStep";
import { EmailLinkStep } from "@/components/auth/EmailLinkStep";
import { SetPasswordStep } from "@/components/auth/SetPasswordStep";
import { PasswordStep } from "@/components/auth/PasswordStep";
import { NotApprovedStep } from "@/components/auth/NotApprovedStep";
import { useSEO } from "@/hooks/use-seo";

const Auth: React.FC = () => {
  useSEO({
    title: "Sign In | GoAiMEX Investor Portal",
    description: "Sign in to access your GoAiMEX investor portal account.",
    noindex: true,
  });

  const { authStep, completeEmailLinkSignIn, isReady, isLoading, needsPasswordSetup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authStep === "authenticated" && !needsPasswordSetup) {
      navigate("/investor", { replace: true });
    }
  }, [authStep, needsPasswordSetup, navigate]);

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

  // Show loading spinner while auth is initializing or during login process
  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        {/* Subtle background gradient */}
        <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>

        {/* Footer */}
        <div className="fixed bottom-4 text-center">
          <p className="text-muted-foreground text-xs">
            © 2026 GoAiMEX. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

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
          © 2026 GoAiMEX. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Auth;
