import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import { createAdminClient } from "@/lib/supabase/admin";

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

// Feed sources → mapped to your app's category + visual style
const FEEDS: {
  url: string;
  source: string;
  category: string;
  emoji: string;
  thumb_gradient: string;
}[] = [
  {
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    source: "The New York Times",
    category: "World",
    emoji: "🗞️",
    thumb_gradient: "linear-gradient(135deg,#3B82F6,#1D4ED8)",
  },
  {
    url: "http://feeds.bbci.co.uk/news/world/rss.xml",
    source: "BBC News",
    category: "World",
    emoji: "🌍",
    thumb_gradient: "linear-gradient(135deg,#EF4444,#B91C1C)",
  },
  {
    url: "https://www.indiatoday.in/rss/1206578",
    source: "India Today",
    category: "India",
    emoji: "🇮🇳",
    thumb_gradient: "linear-gradient(135deg,#F59E0B,#B45309)",
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

function extractImage(item: any): string | null {
  // 1. Standard <enclosure> tag (rss-parser parses this automatically)
  if (item.enclosure?.url && /\.(jpe?g|png|webp|gif)/i.test(item.enclosure.url)) {
    return item.enclosure.url;
  }
  // 2. Media RSS <media:content>
  if (Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
    const url = item.mediaContent[0]?.$?.url;
    if (url) return url;
  }
  // 3. Media RSS <media:thumbnail>
  if (item.mediaThumbnail?.$?.url) {
    return item.mediaThumbnail.$.url;
  }
  // 4. Fallback: find first <img src="..."> inside content/description HTML
  const html = item.content || item["content:encoded"] || item.summary || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  return null;
}

export async function GET(req: NextRequest) {
  // Protect the route so only Vercel Cron (or you, with the secret) can trigger it
  const authHeader = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const isAuthorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || querySecret === process.env.CRON_SECRET;
  if (!isAuthorized) {
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
        const imageUrl = extractImage(item);

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
          image_url: imageUrl,
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
