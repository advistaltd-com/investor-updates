import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";

export const OtpStep: React.FC = () => {
  const { email, setAuthStep, verifyOtp, sendOtp, setError, error, isLoading, setIsLoading } = useAuth();
  const [otp, setOtp] = useState("");
  const [attempts, setAttempts] = useState(0);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const isValid = await verifyOtp(email, otp);
      
      if (isValid) {
        setAuthStep("set-password");
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 3) {
          setError("Maximum attempts reached. Please request a new code.");
        } else {
          setError(`Invalid code. ${3 - newAttempts} attempts remaining.`);
        }
        setOtp("");
      }
    } catch (err) {
      setError("Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError(null);
    setAttempts(0);
    
    try {
      await sendOtp(email);
      setOtp("");
    } catch (err) {
      setError("Failed to resend code. Please try again.");
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
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          Check your email
        </h1>
        <p className="text-muted-foreground text-sm">
          We sent a 6-digit code to<br />
          <span className="text-foreground font-medium">{email}</span>
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            value={otp}
            onChange={setOtp}
            maxLength={6}
            disabled={isLoading || attempts >= 3}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="w-12 h-14 text-xl bg-secondary/50 border-border" />
              <InputOTPSlot index={1} className="w-12 h-14 text-xl bg-secondary/50 border-border" />
              <InputOTPSlot index={2} className="w-12 h-14 text-xl bg-secondary/50 border-border" />
              <InputOTPSlot index={3} className="w-12 h-14 text-xl bg-secondary/50 border-border" />
              <InputOTPSlot index={4} className="w-12 h-14 text-xl bg-secondary/50 border-border" />
              <InputOTPSlot index={5} className="w-12 h-14 text-xl bg-secondary/50 border-border" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        <Button
          onClick={handleVerify}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          disabled={isLoading || otp.length !== 6 || attempts >= 3}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Verify Code"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn't receive a code?{" "}
          <button
            onClick={handleResend}
            disabled={isLoading}
            className="text-primary hover:underline disabled:opacity-50"
          >
            Resend
          </button>
        </p>

        <p className="text-center text-xs text-muted-foreground">
          Demo: Use code <span className="font-mono text-foreground">123456</span>
        </p>
      </div>
    </motion.div>
  );
};
