import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { decode } from "html-entities";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
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
  {
    url: "https://feeds.washingtonpost.com/rss/world",
    source: "The Washington Post",
    category: "World",
    emoji: "🏛️",
    thumb_gradient: "linear-gradient(135deg,#1E293B,#0F172A)",
  },
  {
    url: "https://www.theguardian.com/world/rss",
    source: "The Guardian",
    category: "World",
    emoji: "📰",
    thumb_gradient: "linear-gradient(135deg,#0B5A46,#052E20)",
  },
  {
    url: "https://www.independent.co.uk/rss",
    source: "The Independent",
    category: "World",
    emoji: "🔷",
    thumb_gradient: "linear-gradient(135deg,#DC2626,#7F1D1D)",
  },
  {
    url: "https://www.ft.com/rss/home",
    source: "Financial Times",
    category: "Business",
    emoji: "💹",
    thumb_gradient: "linear-gradient(135deg,#FFCF9E,#B8860B)",
  },

  // ============ NEW: India-focused student / jobs / awareness feeds ============
  {
    url: "https://feeds.feedburner.com/NDTV-LatestNews",
    source: "NDTV",
    category: "India",
    emoji: "🔺",
    thumb_gradient: "linear-gradient(135deg,#DC2626,#7F1D1D)",
  },
  {
    url: "https://www.thehindu.com/news/feeder/default.rss",
    source: "The Hindu",
    category: "India",
    emoji: "📰",
    thumb_gradient: "linear-gradient(135deg,#1E3A8A,#1E293B)",
  },
  {
    url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
    source: "Times of India",
    category: "India",
    emoji: "🕰️",
    thumb_gradient: "linear-gradient(135deg,#DB2777,#9D174D)",
  },
  {
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
    source: "PIB India",
    category: "Awareness",
    emoji: "📢",
    thumb_gradient: "linear-gradient(135deg,#0EA5E9,#0369A1)",
  },
  {
    url: "https://www.hindustantimes.com/feeds/rss/education/rssfeed.xml",
    source: "Hindustan Times Education",
    category: "Education",
    emoji: "🎓",
    thumb_gradient: "linear-gradient(135deg,#7C3AED,#4C1D95)",
  },
  {
    url: "https://www.thebetterindia.com/topics/education/feed/",
    source: "The Better India",
    category: "Education",
    emoji: "🌱",
    thumb_gradient: "linear-gradient(135deg,#16A34A,#166534)",
  },
];

function estimateReadTime(text: string) {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

// Strip HTML tags AND decode entities (&#039; &amp; &quot; etc.)
function cleanText(html: string) {
  const noTags = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return decode(noTags);
}

function extractImage(item: any): string | null {
  if (item.enclosure?.url) {
    const looksLikeImage =
      /\.(jpe?g|png|webp|gif|avif)/i.test(item.enclosure.url) ||
      (typeof item.enclosure.type === "string" && item.enclosure.type.startsWith("image"));
    if (looksLikeImage) return item.enclosure.url;
  }

  if (Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
    for (const mc of item.mediaContent) {
      const url = mc?.$?.url;
      const type = mc?.$?.type;
      if (url && (!type || type.startsWith("image"))) return url;
    }
  }

  if (item.mediaThumbnail?.$?.url) {
    return item.mediaThumbnail.$.url;
  }

  const html = item.content || item["content:encoded"] || item.summary || "";
  const srcMatch = html.match(/<img[^>]+(?:data-)?src=["']([^"']+)["']/i);
  if (srcMatch) return srcMatch[1];

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
        const cleanBody = cleanText(rawBody);
        const cleanTitle = decode(item.title);
        const imageUrl = extractImage(item);

        const bodyParagraphs = [cleanBody || "Read the full story at the source link."];

        const { error } = await supabase.from("news_articles").insert({
          category: feed.category,
          emoji: feed.emoji,
          thumb_gradient: feed.thumb_gradient,
          title: cleanTitle,
          source: feed.source,
          read_time: estimateReadTime(cleanBody),
          body: bodyParagraphs,
          is_featured: false,
          source_url: item.link,
          image_url: imageUrl,
        });

        if (error) {
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
