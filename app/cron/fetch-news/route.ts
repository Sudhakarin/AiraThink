import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import { createAdminClient } from "@/lib/supabase/admin";

const parser = new Parser();

// Feed sources → mapped to your app's category + visual style
const FEEDS: {
  url: string;
  source: string;
  category: string;
  emoji: string;
  thumb_gradient: string;
}[] = [
  {
    url: "https://techcrunch.com/feed/",
    source: "TechCrunch",
    category: "Startups",
    emoji: "🚀",
    thumb_gradient: "linear-gradient(135deg,#7C5CFF,#5B3FD9)",
  },
  {
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    source: "TechCrunch AI",
    category: "AI",
    emoji: "🤖",
    thumb_gradient: "linear-gradient(135deg,#22D3B8,#0E9B86)",
  },
  {
    url: "https://venturebeat.com/category/ai/feed/",
    source: "VentureBeat",
    category: "AI",
    emoji: "⚡",
    thumb_gradient: "linear-gradient(135deg,#EC4899,#9D174D)",
  },
];

function estimateReadTime(text: string) {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  // Protect the route so only Vercel Cron (or you, with the secret) can trigger it
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of parsed.items.slice(0, 8)) {
        if (!item.link || !item.title) continue;

        const rawBody = item.contentSnippet || item.content || item.summary || "";
        const cleanBody = stripHtml(rawBody);

        // Split into 2-3 paragraphs for the reader view; fall back to single paragraph
        const bodyParagraphs =
          cleanBody.length > 280
            ? [cleanBody.slice(0, Math.ceil(cleanBody.length / 2)), cleanBody.slice(Math.ceil(cleanBody.length / 2))]
            : [cleanBody || "Read the full story at the source link."];

        const { error } = await supabase.from("news_articles").insert({
          category: feed.category,
          emoji: feed.emoji,
          thumb_gradient: feed.thumb_gradient,
          title: item.title,
          source: feed.source,
          read_time: estimateReadTime(cleanBody),
          body: bodyParagraphs,
          is_featured: false,
          source_url: item.link,
        });

        if (error) {
          // Duplicate (unique source_url) is expected and fine — just skip
          if (error.code === "23505") {
            skipped++;
          } else {
            errors.push(`${feed.source}: ${error.message}`);
          }
        } else {
          inserted++;
        }
      }
    } catch (e: any) {
      errors.push(`${feed.source} fetch failed: ${e.message}`);
    }
  }

  return NextResponse.json({ inserted, skipped, errors });
}
