import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export const EmailLinkStep: React.FC = () => {
  const { email, setAuthStep, sendEmailLink, setError, error, isLoading, setIsLoading } = useAuth();

  const handleResend = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await sendEmailLink(email);
    } catch (err) {
      setError("Failed to resend the sign-in link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm"
    >
      <button
        onClick={() => setAuthStep("email")}
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </button>

      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <MailCheck className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          Check your inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          We sent a secure sign-in link to
          <br />
          <span className="text-foreground font-medium">{email}</span>
        </p>
      </div>

      <div className="space-y-4">
        {error && <p className="text-destructive text-sm text-center">{error}</p>}

        <Button
          onClick={handleResend}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Resend link"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Open the email on this device to finish setup.
        </p>
      </div>
    </motion.div>
  );
};
