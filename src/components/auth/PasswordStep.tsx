import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

export const PasswordStep: React.FC = () => {
  const { email, setAuthStep, login, setError, error, isLoading, setIsLoading, sendPasswordReset } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) return;

    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) return;
    setResetMessage(null);
    setResetError(null);
    setIsResetting(true);

    try {
      const success = await sendPasswordReset(email);
      if (success) {
        setResetMessage("Password reset email sent. Check your inbox.");
      }
    } catch (err) {
      setResetError("Unable to send reset email. Please try again.");
    } finally {
      setIsResetting(false);
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
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          Welcome back
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your password to continue
        </p>
        <p className="text-foreground text-sm mt-1 font-medium">{email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-secondary/50 border-border focus:border-primary focus:ring-primary pr-10"
              disabled={isLoading}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          disabled={isLoading || !password}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Sign In"
          )}
        </Button>

        <button
          type="button"
          onClick={handlePasswordReset}
          disabled={isResetting}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isResetting ? "Sending reset email..." : "Forgot your password?"}
        </button>

        {resetMessage && (
          <p className="text-green-600 text-sm text-center">{resetMessage}</p>
        )}
        {resetError && (
          <p className="text-destructive text-sm text-center">{resetError}</p>
        )}

      </form>
    </motion.div>
  );
};
