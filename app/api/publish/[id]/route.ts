import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CATEGORY_STYLES: Record<string, { emoji: string; gradient: string }> = {
  World: { emoji: "🗞️", gradient: "linear-gradient(135deg,#3B82F6,#1D4ED8)" },
  India: { emoji: "🇮🇳", gradient: "linear-gradient(135deg,#F59E0B,#B45309)" },
  Business: { emoji: "💹", gradient: "linear-gradient(135deg,#FFCF9E,#B8860B)" },
  Education: { emoji: "🎓", gradient: "linear-gradient(135deg,#7C3AED,#4C1D95)" },
  Awareness: { emoji: "📢", gradient: "linear-gradient(135deg,#0EA5E9,#0369A1)" },
};

function estimateReadTime(text: string) {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const json = await req.json();
    const title = (json.title || "").trim();
    const body = (json.body || "").trim();
    const category = json.category || "India";
    const image_url = json.image_url || null;
    const is_featured = !!json.is_featured;

    if (!title || !body) {
      return NextResponse.json({ error: "Title aur body dono zaroori hain." }, { status: 400 });
    }

    const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.India;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("news_articles")
      .update({
        title,
        body: [body],
        category,
        emoji: style.emoji,
        thumb_gradient: style.gradient,
        read_time: estimateReadTime(body),
        image_url,
        is_featured,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, article: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("news_articles").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
