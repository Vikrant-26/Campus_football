import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();

  if (claimsData?.claims) {
    await supabase.auth.signOut({ scope: "local" });
  }

  revalidatePath("/", "layout");

  return NextResponse.redirect(
    new URL("/auth/login", request.url)
  );
}