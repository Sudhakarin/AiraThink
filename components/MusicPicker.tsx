"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MusicTrack } from "@/app/api/music/search/route";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack) => void;
};

export default function MusicPicker({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTracks([]);
    return () => {
      audioRef.current?.pause();
      setPlayingId(null);
    };
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setTracks([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setTracks(json.tracks ?? []);
      } catch {
        setTracks([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function togglePreview(track: MusicTrack) {
    if (!track.streamUrl) return;
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = track.streamUrl;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    setPlayingId(track.id);
    audioRef.current.onended = () => setPlayingId(null);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex flex-col bg-ink-900" style={{ height: "100dvh" }}>
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            audioRef.current?.pause();
            onClose();
          }}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white"
        >
          ✕
        </button>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Gaana, artist ya album search karein…"
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading && <p className="px-2 text-xs text-mist">Search ho raha hai…</p>}
        {!loading && query && tracks.length === 0 && (
          <p className="px-2 text-xs text-mist">Kuch nahi mila. Doosra naam try karein.</p>
        )}

        <div className="flex flex-col gap-1">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5"
            >
              <button
                type="button"
                onClick={() => togglePreview(track)}
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"
                aria-label={playingId === track.id ? "Pause preview" : "Play preview"}
              >
                {track.thumbnail ? (
                  <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-white/10" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  {playingId === track.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSelect(track)}
                className="flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-white">{track.title}</p>
                <p className="truncate text-xs text-mist">{track.artist}</p>
              </button>

              <button
                type="button"
                onClick={() => onSelect(track)}
                className="shrink-0 rounded-full bg-gradient-to-r from-violet to-violet-light px-3 py-1.5 text-xs font-semibold text-white"
              >
                Use
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
