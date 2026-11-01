"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/auth";

export type FeedbackState = { error: string | null; sent?: boolean };

export async function sendFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { error: "Please write a comment first." };
  if (comment.length > 2000) return { error: "Please keep it under 2000 characters." };

  const supabase = await createAuthClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in to send feedback." };

  const { error } = await supabase.from("feedback").insert({ member_id: auth.user.id, comment });
  if (error) return { error: `Could not send: ${error.message}` };

  revalidatePath("/feedback");
  return { error: null, sent: true };
}
