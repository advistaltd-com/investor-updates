import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, type Timestamp } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { Timeline, TimelineEntry } from "@/components/ui/timeline";
import { Header } from "@/components/layout/Header";
import { db } from "@/lib/firebase";
import { useSEO } from "@/hooks/use-seo";

interface TimelineDoc {
  id: string;
  title: string;
  content_md: string;
  created_at?: Timestamp;
}

const Investor: React.FC = () => {
  useSEO({
    title: "Investor Updates | GoAiMEX Investor Portal",
    description: "View the latest investor updates, milestones, and key developments from GoAiMEX.",
    noindex: true,
  });

  const [updates, setUpdates] = useState<TimelineDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updatesQuery = query(collection(db, "timeline_updates"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(
      updatesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<TimelineDoc, "id">),
        }));
        setUpdates(items);
      },
      () => {
        setError("Unable to load updates right now.");
      },
    );

    return () => unsubscribe();
  }, []);

  const timelineData: TimelineEntry[] = useMemo(
    () =>
      updates.map((update) => {
        const createdAt = update.created_at?.toDate();
        const dateLabel = createdAt ? format(createdAt, "MMM d, yyyy") : "Undated";
        return {
          title: update.title,
          content: (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {dateLabel}
              </p>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content_md}</ReactMarkdown>
              </div>
            </div>
          ),
        };
      }),
    [updates],
  );

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <div className="pt-16">
        {error ? (
          <div className="max-w-3xl mx-auto px-4 md:px-8 lg:px-10 py-16 text-center text-destructive">
            {error}
          </div>
        ) : timelineData.length === 0 ? (
          <div className="max-w-3xl mx-auto px-4 md:px-8 lg:px-10 py-16 text-center text-muted-foreground">
            No investor updates yet.
          </div>
        ) : (
          <Timeline
            data={timelineData}
            heading="GoAiMEX Investor Updates"
            subheading="Track our journey, milestones, and key developments"
          />
        )}
      </div>
    </div>
  );
};

export default Investor;
