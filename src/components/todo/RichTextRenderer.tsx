import { useMemo } from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

interface Props {
  html: string | null | undefined;
  className?: string;
}

/**
 * Renders task description HTML produced by the rich text editor.
 * Sanitizes HTML to prevent stored XSS (e.g. javascript: URLs in shared tasks).
 */
export function RichTextRenderer({ html, className }: Props) {
  const safe = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
    });
  }, [html]);

  if (!safe) return null;
  return (
    <div
      className={cn(
        "prose prose-invert prose-sm max-w-none [&_img]:rounded-xl [&_img]:my-2 [&_img]:border [&_img]:border-border [&_a]:text-primary",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
