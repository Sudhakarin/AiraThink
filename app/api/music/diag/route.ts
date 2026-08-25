import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const targets = [
    "https://api.github.com",
    "https://saavn.me/search/songs?query=test&limit=1",
    "https://saavn.dev/api/search/songs?query=test&limit=1",
  ];

  const results: Record<string, string> = {};

  for (const url of targets) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      results[url] = `OK (status ${res.status})`;
    } catch (err: any) {
      results[url] = `FAILED: ${String(err?.message ?? err)}`;
    }
  }

  return NextResponse.json(results);
}
