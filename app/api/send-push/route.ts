import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { userId, title, body, url } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (subsError) {
    console.error("[send-push] fetching subscriptions failed:", subsError.message);
    return NextResponse.json({ sent: 0, error: subsError.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0, reason: "no subscriptions" });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body, url })
      );
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("[send-push] send failed:", err.statusCode, err.body || err.message);
      }
    }
  }

  return NextResponse.json({ sent });
}
