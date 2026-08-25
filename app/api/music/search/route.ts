import { NextRequest, NextResponse } from "next/server";

// Unofficial JioSaavn API — no auth needed, community-maintained wrapper.
// Docs/source: https://docs.saavn.me
const SAAVN_BASE = "https://saavn.me";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  durationSec: number;
  streamUrl: string; // best-available quality direct link
};

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const limit = req.nextUrl.searchParams.get("limit") ?? "20";

  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(
      `${SAAVN_BASE}/search/songs?query=${encodeURIComponent(query)}&page=1&limit=${limit}`,
      {
        headers: {
          accept: "application/json",
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    const rawText = await upstream.text();

    if (!upstream.ok) {
      return NextResponse.json(
        { tracks: [], error: "upstream_unavailable", status: upstream.status, body: rawText.slice(0, 300) },
        { status: 502 }
      );
    }

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { tracks: [], error: "upstream_not_json", body: rawText.slice(0, 300) },
        { status: 502 }
      );
    }

    const results = json?.data?.results ?? [];

    const tracks: MusicTrack[] = results.map((r: any) => {
      // downloadUrl / image are arrays of { quality, link } — pick the highest available
      const downloadUrl: { quality: string; link: string }[] = r.downloadUrl ?? [];
      const best =
        downloadUrl.find((d) => d.quality === "320kbps") ??
        downloadUrl[downloadUrl.length - 1] ??
        null;
      const images: { quality: string; link: string }[] = r.image ?? [];

      const artistNames =
        r.primaryArtists ||
        (r.artists?.primary ?? []).map((a: any) => a.name).join(", ") ||
        "Unknown artist";

      return {
        id: r.id,
        title: decodeHtml(r.name ?? "Unknown"),
        artist: decodeHtml(artistNames),
        thumbnail: images[images.length - 1]?.link ?? "",
        durationSec: Number(r.duration ?? 0),
        streamUrl: best?.link ?? "",
      };
    });

    return NextResponse.json({ tracks });
  } catch (err: any) {
    clearTimeout(timeout);
    console.error("music search failed", err);
    return NextResponse.json(
      { tracks: [], error: "search_failed", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');
}
