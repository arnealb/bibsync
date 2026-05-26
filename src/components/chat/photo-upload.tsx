"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a photo to the chat-photos bucket and hands back its public URL. */
export function PhotoUpload({
  roomId,
  userId,
  onUploaded,
}: {
  roomId: string;
  userId: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(copy.chat.photo.invalid);
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(copy.chat.photo.tooLarge);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      // First folder must be the uid (RLS); room id is kept in the filename.
      const path = `${userId}/${roomId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("chat-photos")
        .upload(path, file, { cacheControl: "3600" });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-photos").getPublicUrl(path);
      onUploaded(publicUrl);
    } catch {
      toast.error(copy.chat.photo.error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={copy.chat.photo.button}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
      </Button>
    </>
  );
}
