import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, limit, query, type Timestamp } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { auth, db } from "@/lib/firebase";
import { getFunctionUrl } from "@/lib/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/layout/Header";
import { useSEO } from "@/hooks/use-seo";

interface UpdateDoc {
  id: string;
  title: string;
  content_md: string;
  created_at?: Timestamp;
  email_sent?: boolean;
}

const Admin: React.FC = () => {
  useSEO({
    title: "Admin Dashboard | GoAiMEX Investor Portal",
    description: "Admin dashboard for managing and publishing investor updates.",
    noindex: true,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<UpdateDoc[]>([]);

  useEffect(() => {
    const updatesQuery = query(collection(db, "timeline_updates"), orderBy("created_at", "desc"), limit(5));
    const unsubscribe = onSnapshot(updatesQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<UpdateDoc, "id">),
      }));
      setRecentUpdates(items);
    });

    return () => unsubscribe();
  }, []);

  const previewMarkdown = useMemo(() => content.trim(), [content]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!title.trim() || content.trim().length < 20) {
      setError("Add a title and at least 20 characters of content.");
      return;
    }

    if (!auth.currentUser) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    setIsSending(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(getFunctionUrl("send-investor-update"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          content_md: content.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send update. Please retry.");
      }

      setTitle("");
      setContent("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send update.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <div className="max-w-5xl mx-auto px-4 md:px-8 lg:px-10 pt-24 pb-16 space-y-10">
        <div>
          <h1 className="text-3xl md:text-4xl text-foreground mb-2">Admin Updates</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Publish investor updates and trigger Resend notifications.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Update title</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Q1 2026 Investor Update"
                className="bg-secondary/50 border-border"
                disabled={isSending}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Update content (Markdown)</label>
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Share milestones, metrics, and next steps..."
                className="bg-secondary/50 border-border min-h-[240px]"
                disabled={isSending}
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
            {success && <p className="text-emerald-400 text-sm">Update sent to subscribed investors.</p>}

            <Button
              type="submit"
              className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Send update"}
            </Button>
          </form>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">Preview</h2>
              {previewMarkdown ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewMarkdown}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Start typing to preview the update.</p>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent updates</h2>
              <div className="space-y-3">
                {recentUpdates.length === 0 && (
                  <p className="text-muted-foreground text-sm">No updates yet.</p>
                )}
                {recentUpdates.map((update) => (
                  <div key={update.id} className="border border-border rounded-lg p-3">
                    <p className="text-sm font-medium text-foreground">{update.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {update.created_at?.toDate().toLocaleDateString() || "Drafted"}
                      {" · "}
                      {update.email_sent ? "Email sent" : "Pending email"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
