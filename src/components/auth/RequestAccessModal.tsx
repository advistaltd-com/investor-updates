import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";

const requestSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  firm: z.string().min(2, "Firm name is required").max(100),
  email: z.string().email("Invalid email address"),
  linkedin: z.string().url("Invalid URL").optional().or(z.literal("")),
  note: z.string().max(500, "Note must be less than 500 characters").optional(),
});

interface RequestAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillEmail?: string;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({
  open,
  onOpenChange,
  prefillEmail = "",
}) => {
  const [formData, setFormData] = useState({
    name: "",
    firm: "",
    email: prefillEmail,
    linkedin: "",
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, email: prefillEmail }));
  }, [prefillEmail]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const encode = (data: Record<string, string>) => new URLSearchParams(data).toString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    const result = requestSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode({
          "form-name": "request-access",
          name: formData.name,
          firm: formData.firm,
          email: formData.email,
          linkedin: formData.linkedin,
          note: formData.note,
        }),
      });
      setIsSubmitted(true);
    } catch (err) {
      setSubmitError("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setFormData({ name: "", firm: "", email: prefillEmail, linkedin: "", note: "" });
      setErrors({});
      setIsSubmitted(false);
    }, 300);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Request Access
              </h2>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Request Submitted
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    We'll review your request and get back to you within 2-3 business days.
                  </p>
                  <Button onClick={handleClose} variant="outline">
                    Close
                  </Button>
                </motion.div>
              ) : (
                <form
                  name="request-access"
                  method="POST"
                  data-netlify="true"
                  data-netlify-honeypot="bot-field"
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <input type="hidden" name="form-name" value="request-access" />
                  <div className="hidden">
                    <label>
                      Don't fill this out if you're human: <input name="bot-field" />
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Full Name *
                    </label>
                    <Input
                      name="name"
                      placeholder="John Smith"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className="bg-secondary/50 border-border"
                      disabled={isSubmitting}
                    />
                    {errors.name && (
                      <p className="text-destructive text-xs">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Firm / Company *
                    </label>
                    <Input
                      name="firm"
                      placeholder="Acme Ventures"
                      value={formData.firm}
                      onChange={(e) => handleChange("firm", e.target.value)}
                      className="bg-secondary/50 border-border"
                      disabled={isSubmitting}
                    />
                    {errors.firm && (
                      <p className="text-destructive text-xs">{errors.firm}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Email *
                    </label>
                    <Input
                      type="email"
                      name="email"
                      placeholder="john@acmeventures.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className="bg-secondary/50 border-border"
                      disabled={isSubmitting}
                    />
                    {errors.email && (
                      <p className="text-destructive text-xs">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      LinkedIn / Website
                    </label>
                    <Input
                      name="linkedin"
                      placeholder="https://linkedin.com/in/johnsmith"
                      value={formData.linkedin}
                      onChange={(e) => handleChange("linkedin", e.target.value)}
                      className="bg-secondary/50 border-border"
                      disabled={isSubmitting}
                    />
                    {errors.linkedin && (
                      <p className="text-destructive text-xs">{errors.linkedin}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Note (optional)
                    </label>
                    <Textarea
                      name="note"
                      placeholder="Tell us about your interest..."
                      value={formData.note}
                      onChange={(e) => handleChange("note", e.target.value)}
                      className="bg-secondary/50 border-border resize-none"
                      rows={3}
                      disabled={isSubmitting}
                    />
                    {errors.note && (
                      <p className="text-destructive text-xs">{errors.note}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Submit Request"
                    )}
                  </Button>
                  {submitError && (
                    <p className="text-destructive text-xs text-center">{submitError}</p>
                  )}
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
