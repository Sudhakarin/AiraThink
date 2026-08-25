import { NextRequest, NextResponse } from "next/server";

// Three independent sources, tried in order until one returns results:
//   1. Deezer  — global commercial catalog, 30s preview clips, no key
//   2. iTunes  — global commercial catalog, 30s preview clips, no key
//   3. Jamendo — royalty-free / Creative Commons, FULL-length tracks, safe for commercial use
//
// Pass ?source=global to only use Deezer+iTunes, ?source=cc to only use Jamendo,
// or omit it (default "auto") to fall through all three in order.

const JAMENDO_CLIENT_ID = "0108e756";
const JAMENDO_BASE = "https://api.jamendo.com/v3.0/tracks";

export type MusicSource = "deezer" | "itunes" | "jamendo";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string | null;
  streamUrl: string | null;
  /** Present for full-length tracks (Jamendo). 30s-preview sources omit this. */
  durationSec?: number;
  source: MusicSource;
};

type SourceMode = "auto" | "global" | "cc";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = req.nextUrl.searchParams.get("limit") ?? "20";
  const mode = (req.nextUrl.searchParams.get("source") as SourceMode) || "auto";

  if (!q) {
    return NextResponse.json({ tracks: [] });
  }

  const errors: string[] = [];
  const attempted: { source: MusicSource; count: number }[] = [];

  async function tryDeezer() {
    try {
      const tracks = await searchDeezer(q, limit);
      attempted.push({ source: "deezer", count: tracks.length });
      if (tracks.length) return tracks;
    } catch (err) {
      attempted.push({ source: "deezer", count: 0 });
      errors.push(msg("deezer", err));
    }
    return [];
  }

  async function tryItunes() {
    try {
      const tracks = await searchItunes(q, limit);
      attempted.push({ source: "itunes", count: tracks.length });
      if (tracks.length) return tracks;
    } catch (err) {
      attempted.push({ source: "itunes", count: 0 });
      errors.push(msg("itunes", err));
    }
    return [];
  }

  async function tryJamendo() {
    try {
      const tracks = await searchJamendo(q, limit);
      attempted.push({ source: "jamendo", count: tracks.length });
      if (tracks.length) return tracks;
    } catch (err) {
      attempted.push({ source: "jamendo", count: 0 });
      errors.push(msg("jamendo", err));
    }
    return [];
  }

  let tracks: MusicTrack[] = [];

  if (mode === "global") {
    tracks = await tryDeezer();
    if (!tracks.length) tracks = await tryItunes();
  } else if (mode === "cc") {
    tracks = await tryJamendo();
  } else {
    // auto: Deezer -> iTunes -> Jamendo, first non-empty wins
    tracks = await tryDeezer();
    if (!tracks.length) tracks = await tryItunes();
    if (!tracks.length) tracks = await tryJamendo();
  }

  if (!tracks.length && errors.length) {
    return NextResponse.json(
      { tracks: [], error: errors.join("; "), meta: { attempted, mode } },
      { status: 502 }
    );
  }

  return NextResponse.json({
    tracks,
    meta: {
      mode,
      usedSource: tracks[0]?.source ?? null,
      attempted, // e.g. [{source:"deezer",count:0},{source:"itunes",count:0},{source:"jamendo",count:12}]
    },
  });
}

function msg(source: MusicSource, err: unknown) {
  return `${source}: ${err instanceof Error ? err.message : String(err)}`;
}

async function searchDeezer(q: string, limit: string): Promise<MusicTrack[]> {
  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const data: any[] = json?.data ?? [];
  return data
    .filter((t) => t?.preview)
    .map(
      (t): MusicTrack => ({
        id: `dz-${t.id}`,
        title: t.title,
        artist: t.artist?.name ?? "Unknown",
        thumbnail: t.album?.cover_medium ?? t.album?.cover ?? null,
        streamUrl: t.preview,
        source: "deezer",
      })
    );
}

async function searchItunes(q: string, limit: string): Promise<MusicTrack[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(
      q
    )}&media=music&limit=${limit}&country=IN`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const results: any[] = json?.results ?? [];
  return results
    .filter((t) => t?.previewUrl)
    .map(
      (t): MusicTrack => ({
        id: `it-${t.trackId}`,
        title: t.trackName,
        artist: t.artistName,
        thumbnail: t.artworkUrl100
          ? t.artworkUrl100.replace("100x100", "300x300")
          : null,
        streamUrl: t.previewUrl,
        source: "itunes",
      })
    );
}

async function searchJamendo(q: string, limit: string): Promise<MusicTrack[]> {
  const url =
    `${JAMENDO_BASE}/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=${limit}` +
    `&namesearch=${encodeURIComponent(q)}&audioformat=mp31&include=musicinfo`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const results: any[] = json?.results ?? [];
  return results
    .filter((r) => r?.audio)
    .map(
      (r): MusicTrack => ({
        id: `jm-${r.id}`,
        title: r.name ?? "Unknown",
        artist: r.artist_name ?? "Unknown artist",
        thumbnail: r.album_image || r.image || null,
        durationSec: Number(r.duration ?? 0),
        streamUrl: r.audio,
        source: "jamendo",
      })
    );
}
