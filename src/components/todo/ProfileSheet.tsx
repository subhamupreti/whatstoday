import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

export interface Profile {
  display_name: string | null;
  phone: string | null;
  designation: string | null;
  avatar_url: string | null;
}

interface Props {
  user: User;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: Profile | null;
  onSaved: (p: Profile) => void;
}

export function ProfileSheet({ user, open, onOpenChange, profile, onSaved }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName(profile?.display_name ?? "");
      setPhone(profile?.phone ?? "");
      setDesignation(profile?.designation ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
    }
  }, [open, profile]);

  const initials = (displayName || user.email || "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image must be under 3MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      user_id: user.id,
      display_name: displayName.trim() || null,
      phone: phone.trim() || null,
      designation: designation.trim() || null,
      avatar_url: avatarUrl,
    };
    // Update if a row exists, otherwise insert. The handle_new_user trigger
    // should already have created the row, so update is the common path.
    const { error: updErr } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id);
    const error = updErr
      ? (await supabase.from("profiles").insert(payload)).error
      : null;
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    onSaved({
      display_name: payload.display_name,
      phone: payload.phone,
      designation: payload.designation,
      avatar_url: payload.avatar_url,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90dvh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>This is how others will see you.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pt-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="size-24 ring-2 ring-primary/30">
                <AvatarImage src={avatarUrl ?? undefined} alt="Avatar" />
                <AvatarFallback className="bg-secondary text-xl font-bold">{initials || "?"}</AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -right-1 size-9 rounded-full btn-velocity flex items-center justify-center cursor-pointer text-primary-foreground"
              >
                {uploading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Tap the camera to change photo</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Product Designer"
            />
          </div>

          <Button onClick={save} disabled={saving || uploading} className="w-full btn-velocity text-primary-foreground">
            {saving ? <Loader2 className="animate-spin" size={16} /> : "Save profile"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
