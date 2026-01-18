import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { RequestAccessModal } from "./RequestAccessModal";

export const NotApprovedStep: React.FC = () => {
  const { email, setAuthStep } = useAuth();
  const [showRequestModal, setShowRequestModal] = useState(false);

  return (
    <>
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
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
            Access Restricted
          </h1>
          <p className="text-muted-foreground text-sm">
            This portal is limited to existing investors.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-secondary/30 rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground text-center">
              <span className="text-foreground font-medium">{email}</span>
              <br />
              is not on the approved investor list.
            </p>
          </div>

          <Button
            onClick={() => setShowRequestModal(true)}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            Request Access
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Already an investor? Contact us at{" "}
            <a href="mailto:investors@goaimex.com" className="text-primary hover:underline">
              investors@goaimex.com
            </a>
          </p>
        </div>
      </motion.div>

      <RequestAccessModal 
        open={showRequestModal} 
        onOpenChange={setShowRequestModal}
        prefillEmail={email}
      />
    </>
  );
};
