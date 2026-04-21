import { useMemo, useState } from "react";
import { Music2, Plus, X, ExternalLink, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Provider = "youtube" | "spotify" | "soundcloud" | "apple" | "other";

interface ParsedLink {
  url: string;
  provider: Provider;
  title: string;
  embedUrl?: string;
  thumb?: string;
}

function parseLink(raw: string): ParsedLink | null {
  const url = raw.trim();
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return {
      url: u.toString(),
      provider: "youtube",
      title: "YouTube",
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (host.endsWith("youtube.com")) {
    const id = u.searchParams.get("v");
    if (id) {
      return {
        url: u.toString(),
        provider: "youtube",
        title: "YouTube",
        embedUrl: `https://www.youtube.com/embed/${id}`,
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  // Spotify (open.spotify.com/{type}/{id})
  if (host.endsWith("spotify.com")) {
    const m = u.pathname.match(/\/(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/);
    if (m) {
      return {
        url: u.toString(),
        provider: "spotify",
        title: "Spotify",
        embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
      };
    }
  }

  // SoundCloud
  if (host.endsWith("soundcloud.com")) {
    return {
      url: u.toString(),
      provider: "soundcloud",
      title: "SoundCloud",
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&color=%23ff5500&auto_play=false`,
    };
  }

  // Apple Music
  if (host.endsWith("music.apple.com")) {
    return {
      url: u.toString(),
      provider: "apple",
      title: "Apple Music",
      embedUrl: u.toString().replace("music.apple.com", "embed.music.apple.com"),
    };
  }

  return { url: u.toString(), provider: "other", title: host };
}

const providerColor: Record<Provider, string> = {
  youtube: "text-red-400",
  spotify: "text-emerald-400",
  soundcloud: "text-orange-400",
  apple: "text-pink-400",
  other: "text-muted-foreground",
};

interface EditorProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function MusicLinksEditor({ value, onChange }: EditorProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const parsed = parseLink(draft);
    if (!parsed) {
      setError("Enter a valid URL");
      return;
    }
    if (value.includes(parsed.url)) {
      setError("Already added");
      return;
    }
    setError(null);
    onChange([...value, parsed.url]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Paste YouTube, Spotify, SoundCloud or Apple Music link"
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={add} aria-label="Add link">
          <Plus size={16} />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((url) => {
            const p = parseLink(url);
            if (!p) return null;
            return (
              <li
                key={url}
                className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2"
              >
                <Music2 size={14} className={providerColor[p.provider]} />
                <span className="text-xs font-semibold uppercase tracking-wider">{p.title}</span>
                <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== url))}
                  aria-label="Remove link"
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface ListProps {
  links: string[];
  className?: string;
}

export function MusicLinksList({ links, className }: ListProps) {
  const parsed = useMemo(
    () => links.map(parseLink).filter((p): p is ParsedLink => p !== null),
    [links],
  );
  const [playing, setPlaying] = useState<string | null>(null);

  if (!parsed.length) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {parsed.map((p) => {
        const isOpen = playing === p.url;
        return (
          <div key={p.url} className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Music2 size={16} className={providerColor[p.provider]} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider">{p.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{p.url}</p>
              </div>
              {p.embedUrl ? (
                <button
                  type="button"
                  onClick={() => setPlaying(isOpen ? null : p.url)}
                  className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors"
                  aria-label={isOpen ? "Hide player" : "Play"}
                >
                  <Play size={14} className={isOpen ? "opacity-50" : ""} />
                </button>
              ) : (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="size-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
                  aria-label="Open link"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            {isOpen && p.embedUrl && (
              <div className={cn("w-full bg-black", p.provider === "spotify" ? "h-[152px]" : "aspect-video")}>
                <iframe
                  src={p.embedUrl}
                  title={p.title}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
