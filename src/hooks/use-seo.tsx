import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  noindex?: boolean;
}

export const useSEO = ({ title, description, keywords, noindex = true }: SEOProps) => {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, attribute: string = "name") => {
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.content = content;
    };

    if (description) {
      updateMetaTag("description", description);
      updateMetaTag("og:description", description, "property");
      updateMetaTag("twitter:description", description);
    }

    if (title) {
      updateMetaTag("og:title", title, "property");
      updateMetaTag("twitter:title", title);
    }

    if (keywords) {
      updateMetaTag("keywords", keywords);
    }

    // Handle robots meta tag
    if (noindex) {
      updateMetaTag("robots", "noindex, nofollow");
    }

    // Cleanup function to restore defaults if needed
    return () => {
      // Optionally restore default title
      if (title) {
        document.title = "Investor Portal - Private Investor Updates";
      }
    };
  }, [title, description, keywords, noindex]);
};
