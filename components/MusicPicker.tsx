"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MusicTrack } from "@/app/api/music/search/route";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack, startSec: number, clipDurationSec: number) => void;
};

export default function MusicPicker({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [trimTrack, setTrimTrack] = useState<MusicTrack | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTracks([]);
    setTrimTrack(null);
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

  function openTrim(track: MusicTrack) {
    audioRef.current?.pause();
    setPlayingId(null);
    setTrimTrack(track);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex flex-col bg-ink-900" style={{ height: "100dvh" }}>
      {trimTrack ? (
        <TrimScreen
          track={trimTrack}
          onBack={() => setTrimTrack(null)}
          onConfirm={(startSec, clipDurationSec) => {
            onSelect(trimTrack, startSec, clipDurationSec);
          }}
        />
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => {
                audioRef.current?.pause();
                onClose();
              }}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white"
            >
              ✕
            </button>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gaana, artist ya album search karein…"
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet"
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
                    onClick={() => openTrim(track)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-white">{track.title}</p>
                    <p className="truncate text-xs text-mist">{track.artist}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => openTrim(track)}
                    className="shrink-0 rounded-full bg-gradient-to-r from-violet to-violet-light px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

function TrimScreen({
  track,
  onBack,
  onConfirm,
}: {
  track: MusicTrack;
  onBack: () => void;
  onConfirm: (startSec: number, clipDurationSec: number) => void;
}) {
  const [clipLength, setClipLength] = useState<15 | 30>(15);
  const [totalDuration, setTotalDuration] = useState(30);
  const [start, setStart] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bars] = useState<number[]>(() => makeWaveform(track.id));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef(start);
  const clipLenRef = useRef<number>(clipLength);

  useEffect(() => { startRef.current = start; }, [start]);
  useEffect(() => { clipLenRef.current = clipLength; }, [clipLength]);

  useEffect(() => {
    const audio = new Audio(track.streamUrl);
    audioRef.current = audio;
    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    });
    audio.addEventListener("timeupdate", () => {
      if (audio.currentTime >= startRef.current + clipLenRef.current) {
        audio.currentTime = startRef.current;
      }
    });
    audio.addEventListener("pause", () => setIsPlaying(false));
    return () => {
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.streamUrl]);

  const maxStart = Math.max(0, totalDuration - clipLength);

  useEffect(() => {
    setStart((s) => Math.min(s, Math.max(0, totalDuration - clipLength)));
  }, [clipLength, totalDuration]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.currentTime = start;
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function handlePointer(clientX: number) {
    const el = trackRef.current;
    if (!el || totalDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const windowWidthPx = (clipLength / totalDuration) * rect.width;
    const ratio = (clientX - rect.left - windowWidthPx / 2) / rect.width;
    const newStart = Math.min(Math.max(ratio * totalDuration, 0), maxStart);
    setStart(newStart);
    const audio = audioRef.current;
    if (audio && isPlaying) audio.currentTime = newStart;
  }

  const windowPercent = Math.min(100, (clipLength / totalDuration) * 100);
  const leftPercent = totalDuration > 0 ? (start / totalDuration) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            audioRef.current?.pause();
            onBack();
          }}
          aria-label="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{track.title}</p>
          <p className="truncate text-xs text-mist">{track.artist}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            audioRef.current?.pause();
            onConfirm(start, clipLength);
          }}
          className="shrink-0 rounded-full bg-gradient-to-r from-violet to-violet-light px-4 py-1.5 text-xs font-semibold text-white"
        >
          Done
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        {track.thumbnail && (
          <img src={track.thumbnail} alt="" className="h-40 w-40 rounded-2xl object-cover shadow-lg" />
        )}

        <div className="w-full">
          <p className="mb-3 text-center text-xs text-mist">
            Timeline pe khiska kar apna {clipLength}-second hissa chuno
          </p>

          {/* length toggle + scrub line + play/pause, like the reference UI */}
          <div className="mb-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setClipLength((len) => (len === 15 ? 30 : 15))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 text-[11px] font-semibold text-white"
              aria-label="Toggle clip length"
            >
              {clipLength}
            </button>

            <div className="relative h-[2px] flex-1 rounded-full bg-white/20">
              <div
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white"
                style={{ left: `${leftPercent}%` }}
              />
              <div
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/60"
                style={{ left: `${Math.min(100, leftPercent + windowPercent)}%` }}
              />
            </div>

            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink-900"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* waveform with draggable gradient selection window */}
          <div
            ref={trackRef}
            onPointerDown={(e) => {
              draggingRef.current = true;
              (e.target as Element).setPointerCapture(e.pointerId);
              handlePointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (draggingRef.current) handlePointer(e.clientX);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            className="relative flex h-16 w-full touch-none items-center gap-[2px] overflow-hidden rounded-xl px-0.5"
          >
            {bars.map((h, i) => {
              const barPercent = ((i + 0.5) / bars.length) * 100;
              const selected =
                barPercent >= leftPercent && barPercent <= leftPercent + windowPercent;
              return (
                <div
                  key={i}
                  className={`w-[3px] shrink-0 rounded-full transition-colors ${
                    selected ? "bg-white" : "bg-white/15"
                  }`}
                  style={{ height: `${h}%` }}
                />
              );
            })}

            <div
              className="pointer-events-none absolute top-0 h-full rounded-lg border-2 border-white/90 bg-gradient-to-r from-amber-400/30 via-fuchsia-500/30 to-violet/30"
              style={{ left: `${leftPercent}%`, width: `${windowPercent}%` }}
            >
              <div className="absolute inset-y-0 -right-[3px] w-[6px] rounded-full bg-white" />
              <div className="absolute inset-y-0 -left-[3px] w-[6px] rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Deterministic pseudo-random waveform so the shape stays stable per track. */
function makeWaveform(seed: string, count = 70): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const rand = (h >>> 8) / 0xffffff;
    bars.push(24 + rand * 76); // 24%–100% tall
  }
  return bars;
}
