import { NextRequest, NextResponse } from "next/server";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string | null;
  streamUrl: string | null;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const tracks = await searchDeezer(q);
    if (tracks.length > 0) {
      return NextResponse.json({ tracks });
    }
    // Deezer had nothing for this query — try iTunes before giving up.
    const fallback = await searchItunes(q);
    return NextResponse.json({ tracks: fallback });
  } catch (err) {
    // Deezer failed outright (network/geo issue) — iTunes as a safety net.
    try {
      const fallback = await searchItunes(q);
      return NextResponse.json({ tracks: fallback });
    } catch (fallbackErr) {
      return NextResponse.json(
        {
          tracks: [],
          error:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : "Music search is temporarily unavailable",
        },
        { status: 502 }
      );
    }
  }
}

async function searchDeezer(q: string): Promise<MusicTrack[]> {
  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Deezer error ${res.status}`);
  const json = await res.json();
  const data: any[] = json?.data ?? [];
  return data
    .filter((t) => t?.preview) // only tracks that actually have a playable clip
    .map(
      (t): MusicTrack => ({
        id: `dz-${t.id}`,
        title: t.title,
        artist: t.artist?.name ?? "Unknown",
        thumbnail: t.album?.cover_medium ?? t.album?.cover ?? null,
        streamUrl: t.preview, // 30-second mp3 preview
      })
    );
}

async function searchItunes(q: string): Promise<MusicTrack[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(
      q
    )}&media=music&limit=20&country=IN`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`iTunes error ${res.status}`);
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
        streamUrl: t.previewUrl, // 30-second m4a preview
      })
    );
}
