import { cn } from "@/lib/utils";

interface Props {
  html: string | null | undefined;
  className?: string;
}

/**
 * Renders task description HTML produced by the rich text editor.
 * Falls back to nothing when the description is empty.
 */
export function RichTextRenderer({ html, className }: Props) {
  if (!html) return null;
  return (
    <div
      className={cn(
        "prose prose-invert prose-sm max-w-none [&_img]:rounded-xl [&_img]:my-2 [&_img]:border [&_img]:border-border [&_a]:text-primary",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
