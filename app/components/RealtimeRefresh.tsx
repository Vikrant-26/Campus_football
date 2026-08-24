"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    const channel = supabase.channel(
      "matches-list-realtime"
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "matches",
      },
      (payload) => {
        console.log(
          "[Matches] realtime update:",
          payload
        );

        // Refresh the Server Component data
        router.refresh();
      }
    );

    channel.subscribe((status) => {
      console.log(
        "[Matches] realtime status:",
        status
      );
    });

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [router]);

  return null;
}