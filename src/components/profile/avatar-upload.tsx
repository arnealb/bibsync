"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

import { updateAvatar } from "@/app/_actions/profile";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarUpload({
  userId,
  name,
  avatarUrl,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(copy.profile.avatar.invalid);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(copy.profile.avatar.tooLarge);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const result = await updateAvatar(publicUrl);
      if (!result.ok) throw new Error(result.error);

      toast.success(copy.profile.avatar.updated);
      router.refresh();
    } catch {
      toast.error(copy.profile.avatar.error);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onRemove() {
    startTransition(async () => {
      const result = await updateAvatar(null);
      if (result.ok) {
        toast.success(copy.profile.avatar.removed);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar
        name={name}
        avatarUrl={avatarUrl}
        className="size-16"
        fallbackClassName="text-lg"
      />
      <div className="flex flex-col items-start gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          {copy.profile.avatar.upload}
        </Button>
        {avatarUrl && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            {copy.profile.avatar.remove}
          </Button>
        )}
      </div>
    </div>
  );
}
