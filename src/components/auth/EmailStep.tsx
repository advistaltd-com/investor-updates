import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address").trim().toLowerCase();

export const EmailStep: React.FC = () => {
  const {
    setEmail,
    setAuthStep,
    checkEmailApproval,
    sendEmailLink,
    setError,
    setIsLoading,
    isLoading,
    error,
  } = useAuth();
  const [inputEmail, setInputEmail] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    // Validate email
    const result = emailSchema.safeParse(inputEmail);
    if (!result.success) {
      setValidationError(result.error.errors[0].message);
      return;
    }

    const normalizedEmail = result.data;
    setEmail(normalizedEmail);
    setIsLoading(true);

    try {
      const { approved, isExistingUser } = await checkEmailApproval(normalizedEmail);

      if (!approved) {
        setAuthStep("not-approved");
      } else if (!isExistingUser) {
        await sendEmailLink(normalizedEmail);
        setAuthStep("email-link");
      } else {
        // Returning user - show password
        setAuthStep("password");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      // Check if it's a network error (function not available in dev)
      if (errorMessage.includes("fetch") || errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        setError("Unable to connect to server. Make sure Netlify Dev is running (netlify dev) or check your network connection.");
      } else {
        setError(errorMessage);
      }
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
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          Investor Portal
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your email to continue
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="you@company.com"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            className="h-12 bg-secondary/50 border-border focus:border-primary focus:ring-primary"
            disabled={isLoading}
            autoFocus
          />
          {validationError && (
            <p className="text-destructive text-sm">{validationError}</p>
          )}
          {error && !validationError && (
            <p className="text-destructive text-sm">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          disabled={isLoading || !inputEmail}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
};
