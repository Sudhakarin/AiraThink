import { NextRequest, NextResponse } from "next/server";

// Apple's official iTunes Search API — free, no auth, no key needed, never rate-limited/blocked.
// Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
const ITUNES_BASE = "https://itunes.apple.com/search";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number;
  streamUrl: string; // 30-second preview clip (Apple only provides previews via this API)
};

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const limit = req.nextUrl.searchParams.get("limit") ?? "20";

  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const upstream = await fetch(
      `${ITUNES_BASE}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}&country=IN`,
      { cache: "no-store" }
    );

    if (!upstream.ok) {
      return NextResponse.json({ tracks: [], error: "upstream_unavailable" }, { status: 502 });
    }

    const json = await upstream.json();
    const results = json?.results ?? [];

    const tracks: MusicTrack[] = results
      .filter((r: any) => r.previewUrl)
      .map((r: any) => ({
        id: String(r.trackId),
        title: r.trackName ?? "Unknown",
        artist: r.artistName ?? "Unknown artist",
        // bump the default 100x100 artwork up to 300x300
        thumbnail: (r.artworkUrl100 ?? "").replace("100x100", "300x300"),
        durationSec: Math.round((r.trackTimeMillis ?? 0) / 1000),
        streamUrl: r.previewUrl,
      }));

    return NextResponse.json({ tracks });
  } catch (err: any) {
    console.error("music search failed", err);
    return NextResponse.json(
      { tracks: [], error: "search_failed", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
