import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, limit, query, type Timestamp } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Plus, Trash2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { getFunctionUrl } from "@/lib/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/Header";
import { useSEO } from "@/hooks/use-seo";

interface UpdateDoc {
  id: string;
  title: string;
  content_md: string;
  created_at?: Timestamp;
  email_sent?: boolean;
}

interface AllowlistDomain {
  id: string;
  domain: string;
  emails: string[];
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
  
  // Allowlist management state
  const [approvedDomains, setApprovedDomains] = useState<AllowlistDomain[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [isLoadingAllowlist, setIsLoadingAllowlist] = useState(false);
  const [allowlistError, setAllowlistError] = useState<string | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

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

  const loadAllowlist = async () => {
    if (!auth.currentUser) return;

    setIsLoadingAllowlist(true);
    setAllowlistError(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(getFunctionUrl("get-allowlist"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load allowlist.");
      }

      const data = await response.json();
      setApprovedDomains(data.domains || []);
    } catch (err) {
      setAllowlistError(err instanceof Error ? err.message : "Failed to load allowlist.");
    } finally {
      setIsLoadingAllowlist(false);
    }
  };

  useEffect(() => {
    loadAllowlist();
  }, []);

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !auth.currentUser) return;

    setAllowlistError(null);
    setIsLoadingAllowlist(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(getFunctionUrl("manage-allowlist"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "email",
          value: newEmail.trim().toLowerCase(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add email.");
      }

      setNewEmail("");
      await loadAllowlist();
    } catch (err) {
      setAllowlistError(err instanceof Error ? err.message : "Failed to add email.");
    } finally {
      setIsLoadingAllowlist(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim() || !auth.currentUser) return;

    setAllowlistError(null);
    setIsLoadingAllowlist(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(getFunctionUrl("manage-allowlist"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "domain",
          value: newDomain.trim().toLowerCase(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add domain.");
      }

      setNewDomain("");
      await loadAllowlist();
    } catch (err) {
      setAllowlistError(err instanceof Error ? err.message : "Failed to add domain.");
    } finally {
      setIsLoadingAllowlist(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    if (!auth.currentUser) return;

    if (!confirm(`Remove ${email} from approved emails?`)) return;

    setAllowlistError(null);
    setIsLoadingAllowlist(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(getFunctionUrl("manage-allowlist"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "email",
          value: email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to remove email.");
      }

      await loadAllowlist();
    } catch (err) {
      setAllowlistError(err instanceof Error ? err.message : "Failed to remove email.");
    } finally {
      setIsLoadingAllowlist(false);
    }
  };

  const toggleDomain = (domainId: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!auth.currentUser) return;

    if (!confirm(`Remove ${domain} from approved domains?`)) return;

    setAllowlistError(null);
    setIsLoadingAllowlist(true);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(getFunctionUrl("manage-allowlist"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "domain",
          value: domain,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to remove domain.");
      }

      await loadAllowlist();
    } catch (err) {
      setAllowlistError(err instanceof Error ? err.message : "Failed to remove domain.");
    } finally {
      setIsLoadingAllowlist(false);
    }
  };

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
          <h1 className="text-3xl md:text-4xl text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Manage investor updates and access control.
          </p>
        </div>

        <Tabs defaultValue="updates" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="updates">Updates</TabsTrigger>
            <TabsTrigger value="allowlist">Access Control</TabsTrigger>
          </TabsList>

          <TabsContent value="updates" className="space-y-8">
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
          </TabsContent>

          <TabsContent value="allowlist" className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Access Control</h2>
              
              {/* Add Domain */}
              <div className="mb-6">
                <label className="text-sm font-medium text-foreground mb-2 block">Add Domain</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="bg-secondary/50 border-border"
                    disabled={isLoadingAllowlist}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDomain();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddDomain}
                    disabled={!newDomain.trim() || isLoadingAllowlist}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Domain
                  </Button>
                </div>
              </div>

              {/* Add Email */}
              <div className="mb-6">
                <label className="text-sm font-medium text-foreground mb-2 block">Add Email</label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="investor@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="bg-secondary/50 border-border"
                    disabled={isLoadingAllowlist}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddEmail}
                    disabled={!newEmail.trim() || isLoadingAllowlist}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Email
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Email will be added to its domain automatically
                </p>
              </div>

              {allowlistError && (
                <p className="text-destructive text-sm mb-4">{allowlistError}</p>
              )}

              {/* Domains List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {approvedDomains.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No approved domains yet.</p>
                ) : (
                  approvedDomains.map((domain) => (
                    <div
                      key={domain.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-3 bg-secondary/30">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleDomain(domain.id)}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {expandedDomains.has(domain.id) ? "▼" : "▶"} {domain.domain}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            ({domain.emails.length} {domain.emails.length === 1 ? "email" : "emails"})
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveDomain(domain.domain)}
                          disabled={isLoadingAllowlist}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {expandedDomains.has(domain.id) && (
                        <div className="p-3 bg-background border-t border-border">
                          {domain.emails.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No emails for this domain</p>
                          ) : (
                            <div className="space-y-2">
                              {domain.emails.map((email) => (
                                <div
                                  key={email}
                                  className="flex items-center justify-between p-2 bg-secondary/20 rounded"
                                >
                                  <span className="text-xs text-foreground">{email}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveEmail(email)}
                                    disabled={isLoadingAllowlist}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
