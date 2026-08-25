import { NextRequest, NextResponse } from "next/server";

// Jamendo — legal, royalty-free, full-length music library. Free for commercial use.
// Docs: https://developer.jamendo.com
const JAMENDO_CLIENT_ID = "0108e756";
const JAMENDO_BASE = "https://api.jamendo.com/v3.0/tracks";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number;
  streamUrl: string; // full-length track, royalty-free
};

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const limit = req.nextUrl.searchParams.get("limit") ?? "20";

  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const url =
      `${JAMENDO_BASE}/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=${limit}` +
      `&namesearch=${encodeURIComponent(query)}&audioformat=mp31&include=musicinfo`;

    const upstream = await fetch(url, { cache: "no-store" });

    if (!upstream.ok) {
      return NextResponse.json({ tracks: [], error: "upstream_unavailable" }, { status: 502 });
    }

    const json = await upstream.json();
    const results = json?.results ?? [];

    const tracks: MusicTrack[] = results
      .filter((r: any) => r.audio)
      .map((r: any) => ({
        id: String(r.id),
        title: r.name ?? "Unknown",
        artist: r.artist_name ?? "Unknown artist",
        thumbnail: r.album_image ?? r.image ?? "",
        durationSec: Number(r.duration ?? 0),
        streamUrl: r.audio,
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
