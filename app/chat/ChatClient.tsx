"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  status: string;
  last_seen?: string;
  avatar_url?: string | null;
  bio?: string | null;
};

type MessageType = "text" | "image" | "voice";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  message_type?: MessageType;
  media_url?: string | null;
  media_duration?: number | null;
  reply_to_id?: string | null;
};

type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

type Status = {
  id: string;
  user_id: string;
  media_url: string | null;
  text_content: string | null;
  bg_color: string | null;
  created_at: string;
  expires_at: string;
  profile?: Profile;
};

type ConversationRow = {
  id: string;
  is_group: boolean;
  name: string | null;
  otherProfile: Profile | null;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
};

type MobileTab = "home" | "status" | "chats" | "search" | "profile";
type CallStatus = "idle" | "outgoing" | "incoming" | "connected";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const PAGE_SIZE = 30;
const CHAT_MEDIA_BUCKET = "chat-media";
const STATUS_MEDIA_BUCKET = "status-media";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const QUICK_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];
const SWIPE_REPLY_THRESHOLD = 44;
const SWIPE_REPLY_MAX = 64;
const MAX_BIO_LENGTH = 160;
const STATUS_DURATION_MS = 5000;
const STATUS_COLORS = ["#7C5CFF", "#22D3B8", "#EF4444", "#F59E0B", "#3B82F6", "#EC4899", "#111827"];

// Feature highlights shown on the Home tab, animated in on scroll/load.
const HOME_FEATURES = [
  { icon: "🔒", title: "End-to-end encryption", desc: "Your messages stay private, always." },
  { icon: "⚡", title: "Realtime chat", desc: "Messages arrive instantly, no delay." },
  { icon: "⏳", title: "24 hours disappearing", desc: "Status updates vanish after a day." },
  { icon: "🆓", title: "Free to use", desc: "No subscriptions, no hidden costs." },
  { icon: "📶", title: "Works on all networks", desc: "Smooth on 3G, 4G, 5G and beyond." },
];

// Fire-and-forget helper to trigger a push notification via our API route.
// Failures are swallowed so chat functionality never breaks because of push.
function sendPushNotification(opts: { userId?: string | null; title: string; body: string; url?: string }) {
  if (!opts.userId) return;
  fetch("/api/send-push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: opts.userId,
      title: opts.title,
      body: opts.body,
      url: opts.url || "/",
    }),
  }).catch(() => {});
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatLastSeen(iso?: string) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function isVerified(username?: string) {
  return username?.toLowerCase() === "sudhakarin";
}

function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="ml-1 inline-block shrink-0 align-middle">
      <path
        d="M12 2l2.4 1.5 2.8-.4 1.2 2.6 2.6 1.2-.4 2.8L22 12l-1.5 2.4.4 2.8-2.6 1.2-1.2 2.6-2.8-.4L12 22l-2.4-1.5-2.8.4-1.2-2.6-2.6-1.2.4-2.8L2 12l1.5-2.4-.4-2.8 2.6-1.2 1.2-2.6 2.8.4L12 2z"
        fill="#3B9EFF"
      />
      <path d="M8.5 12.3l2.2 2.2 4.8-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Avatar({
  name,
  color,
  size = 40,
  online = false,
  avatarUrl,
}: {
  name: string;
  color: string;
  size?: number;
  online?: boolean;
  avatarUrl?: string | null;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-display text-xs font-bold text-white"
          style={{ background: color }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-ink-900 bg-teal"
          style={{ width: size * 0.3, height: size * 0.3 }}
        />
      )}
    </div>
  );
}

// Wraps an Avatar with a story-style ring when the user has an active status.
// Gradient ring = unseen update, grey ring = already viewed, no ring = no status.
function StatusRing({
  hasStatus,
  viewed,
  children,
}: {
  hasStatus: boolean;
  viewed: boolean;
  children: React.ReactNode;
}) {
  if (!hasStatus) return <>{children}</>;
  return (
    <div
      className="rounded-full p-[2px]"
      style={{
        background: viewed ? "#4B5563" : "linear-gradient(45deg, #7C5CFF, #22D3B8)",
      }}
    >
      <div className="rounded-full bg-ink-900 p-[2px]">{children}</div>
    </div>
  );
}

function Ticks({ read }: { read: boolean }) {
  return read ? (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="inline-block align-middle text-white">
      <path d="M1 5l3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5l3 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="inline-block align-middle text-white/40">
      <path d="M1 5l3 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TabIcon({ tab }: { tab: MobileTab }) {
  if (tab === "home") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 11l8-7 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tab === "status") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
      </svg>
    );
  }
  if (tab === "chats") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tab === "search") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Compact inline audio player used for voice-note messages
function VoiceMessage({ url, duration, mine }: { url: string; duration: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveDuration, setLiveDuration] = useState(duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration)) setLiveDuration(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  return (
    <div className="flex min-w-[190px] items-center gap-2.5 py-0.5">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
          mine ? "bg-white/20 hover:bg-white/30" : "bg-violet/20 hover:bg-violet/30"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="5" height="16" rx="1" />
            <rect x="14" y="4" width="5" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4l14 8-14 8V4z" />
          </svg>
        )}
      </button>
      <div className="flex-1">
        <div className={`h-1 w-full overflow-hidden rounded-full ${mine ? "bg-white/25" : "bg-black/15 dark:bg-white/15"}`}>
          <div
            className={`h-full rounded-full ${mine ? "bg-white" : "bg-violet-light"}`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      </div>
      <span className={`shrink-0 text-[10px] tabular-nums ${mine ? "text-white/70" : "text-mist"}`}>
        {formatDuration(liveDuration)}
      </span>
    </div>
  );
}

// Keeps the app's height in sync with the visible viewport (visualViewport),
// so that on mobile, opening the keyboard shrinks the layout instead of
// pushing the input/send button off-screen behind the keyboard.
function useVisualViewportHeight() {
  useEffect(() => {
    function setHeight() {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    }
    setHeight();
    window.visualViewport?.addEventListener("resize", setHeight);
    window.visualViewport?.addEventListener("scroll", setHeight);
    window.addEventListener("resize", setHeight);
    return () => {
      window.visualViewport?.removeEventListener("resize", setHeight);
      window.visualViewport?.removeEventListener("scroll", setHeight);
      window.removeEventListener("resize", setHeight);
    };
  }, []);
}

// Small pill showing grouped reaction emojis under a bubble
function ReactionPills({
  msgReactions,
  myId,
  onToggle,
}: {
  msgReactions: Reaction[];
  myId: string;
  onToggle: (emoji: string) => void;
}) {
  if (!msgReactions || msgReactions.length === 0) return null;
  const grouped: Record<string, { count: number; mine: boolean }> = {};
  msgReactions.forEach((r) => {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count += 1;
    if (r.user_id === myId) grouped[r.emoji].mine = true;
  });
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Object.entries(grouped).map(([emoji, info]) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition ${
            info.mine
              ? "bg-violet/30 ring-1 ring-violet-light"
              : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
          }`}
        >
          <span>{emoji}</span>
          {info.count > 1 && <span className="text-[10px] text-[color:var(--color-text)]/70">{info.count}</span>}
        </button>
      ))}
    </div>
  );
}

export default function ChatClient({ profile: initialProfile }: { profile: Profile }) {
  const supabase = createClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  useVisualViewportHeight();

  const [myProfile, setMyProfile] = useState<Profile>(initialProfile);
  const [myEmail, setMyEmail] = useState<string>("");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [sending, setSending] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [otherProfileFresh, setOtherProfileFresh] = useState<Profile | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [nameDraft, setNameDraft] = useState(initialProfile.display_name);
  const [bioDraft, setBioDraft] = useState(initialProfile.bio ?? "");
  const [uploading, setUploading] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPrependingRef = useRef(false);

  // --- reply + reactions ---
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, Reaction[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const swipeStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [swipeState, setSwipeState] = useState<{ id: string; dx: number } | null>(null);

  // --- image + voice note messaging ---
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingMimeTypeRef = useRef<string>("audio/webm");

  // --- status / story feature ---
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [myViewedStatusIds, setMyViewedStatusIds] = useState<Set<string>>(new Set());
  const [statusViewerUserId, setStatusViewerUserId] = useState<string | null>(null);
  const [statusViewerIndex, setStatusViewerIndex] = useState(0);
  const [uploadingStatus, setUploadingStatus] = useState(false);
  const [showTextStatusComposer, setShowTextStatusComposer] = useState(false);
  const [textStatusDraft, setTextStatusDraft] = useState("");
  const [textStatusColor, setTextStatusColor] = useState(STATUS_COLORS[0]);
  const statusFileInputRef = useRef<HTMLInputElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callPeer, setCallPeer] = useState<Profile | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = conversations.find((c) => c.id === activeId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setMyEmail(data.user.email);
    });
  }, [supabase]);

  // Register for push notifications once we know who the current user is.
  useEffect(() => {
    subscribeToPush(myProfile.id);
  }, [myProfile.id]);

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);

    const { data: participantRows } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", myProfile.id);

    const convoIds = (participantRows ?? []).map((r) => r.conversation_id);
    if (convoIds.length === 0) {
      setConversations([]);
      setLoadingConvos(false);
      return;
    }

    const { data: convos } = await supabase
      .from("conversations")
      .select("id, is_group, name")
      .in("id", convoIds);

    const { data: otherParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id, profiles(*)")
      .in("conversation_id", convoIds)
      .neq("user_id", myProfile.id);

    const { data: lastMessages } = await supabase
      .from("messages")
      .select("conversation_id, content, message_type, created_at")
      .in("conversation_id", convoIds)
      .order("created_at", { ascending: false });

    const { data: unreadRows } = await supabase
      .from("messages")
      .select("id, conversation_id")
      .in("conversation_id", convoIds)
      .neq("sender_id", myProfile.id)
      .is("read_at", null);

    const unreadCounts: Record<string, number> = {};
    (unreadRows ?? []).forEach((m: any) => {
      unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1;
    });

    const previewFor = (m: any) => {
      if (!m) return "Say hello 👋";
      if (m.message_type === "image") return "📷 Photo";
      if (m.message_type === "voice") return "🎤 Voice message";
      return m.content;
    };

    const rows = (convos ?? []).map((c) => {
      const other = (otherParticipants ?? []).find((p) => p.conversation_id === c.id);
      const last = (lastMessages ?? []).find((m) => m.conversation_id === c.id);
      return {
        id: c.id,
        is_group: c.is_group,
        name: c.name,
        otherProfile: other?.profiles ?? null,
        lastMessage: previewFor(last),
        lastAt: last?.created_at ?? "",
        unreadCount: unreadCounts[c.id] ?? 0,
      };
    });

    rows.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    setConversations(rows as any);
    setLoadingConvos(false);
  }, [myProfile.id, supabase]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const channel = supabase
      .channel("global-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== myProfile.id) {
          loadConversations();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfile.id, supabase, loadConversations]);

  useEffect(() => {
    const channel = supabase.channel("presence:online", {
      config: { presence: { key: myProfile.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfile.id, supabase]);

  useEffect(() => {
    const update = () => {
      supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", myProfile.id).then(() => {});
    };
    update();
    const interval = setInterval(update, 20000);
    return () => clearInterval(interval);
  }, [myProfile.id, supabase]);

  useEffect(() => {
    const otherId = active?.otherProfile?.id;
    if (!otherId) {
      setOtherProfileFresh(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", otherId).single();
      if (!cancelled) setOtherProfileFresh(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.otherProfile?.id, supabase]);

  useEffect(() => {
    if (!activeId) return;

    let cancelled = false;
    setMessages([]);
    setHasMore(true);
    setReplyingTo(null);
    setReactionsByMsg({});

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (cancelled) return;
      const ordered = (data ?? []).slice().reverse();
      setMessages(ordered);
      setHasMore((data ?? []).length === PAGE_SIZE);
      loadReactionsFor(ordered.map((m) => m.id));
    })();

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as Message;
            if (prev.some((m) => m.id === incoming.id)) return prev;
            const withoutTemp = prev.filter(
              (m) =>
                !(
                  m.id.startsWith("temp-") &&
                  m.sender_id === incoming.sender_id &&
                  (m.content === incoming.content ||
                    (m.media_url && m.media_url === incoming.media_url))
                )
            );
            return [...withoutTemp, incoming];
          });
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe();

    // Reactions realtime — refetch grouped counts on any change for this conversation's messages
    const reactionsChannel = supabase
      .channel(`reactions:${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload: any) => {
        const row = (payload.new ?? payload.old) as Reaction | undefined;
        if (!row) return;
        setMessages((current) => {
          if (current.some((m) => m.id === row.message_id)) {
            loadReactionsFor(current.map((m) => m.id));
          }
          return current;
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [activeId, supabase, loadConversations]);

  async function loadReactionsFor(messageIds: string[]) {
    if (messageIds.length === 0) return;
    const { data } = await supabase
      .from("message_reactions")
      .select("*")
      .in("message_id", messageIds);
    const grouped: Record<string, Reaction[]> = {};
    (data ?? []).forEach((r: Reaction) => {
      grouped[r.message_id] = [...(grouped[r.message_id] ?? []), r];
    });
    setReactionsByMsg(grouped);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setReactionPickerFor(null);
    const existing = reactionsByMsg[messageId]?.find(
      (r) => r.user_id === myProfile.id && r.emoji === emoji
    );
    if (existing) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", myProfile.id)
        .eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: myProfile.id,
        emoji,
      });

      // Notify the message's original sender that someone reacted (skip self-reacts).
      const targetMsg = messages.find((m) => m.id === messageId);
      if (targetMsg && targetMsg.sender_id !== myProfile.id) {
        sendPushNotification({
          userId: targetMsg.sender_id,
          title: myProfile.display_name,
          body: `${emoji} reacted to your message`,
          url: "/",
        });
      }
    }
    loadReactionsFor(messages.map((m) => m.id));
  }

  useEffect(() => {
    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function loadMoreMessages() {
    if (!activeId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const older = (data ?? []).slice().reverse();
    if (older.length < PAGE_SIZE) setHasMore(false);

    if (older.length > 0) {
      const container = scrollRef.current;
      const prevHeight = container?.scrollHeight ?? 0;
      isPrependingRef.current = true;
      setMessages((prev) => [...older, ...prev]);
      loadReactionsFor(older.map((m) => m.id));
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevHeight;
        }
      });
    }
    setLoadingMore(false);
  }

  function handleMessagesScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 60) {
      loadMoreMessages();
    }
  }

  useEffect(() => {
    if (!activeId) return;
    const unreadIds = messages
      .filter((m) => m.sender_id !== myProfile.id && !m.read_at && !m.id.startsWith("temp-"))
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => loadConversations());
  }, [messages, activeId, myProfile.id, supabase, loadConversations]);

  useEffect(() => {
    setShowContactInfo(false);
  }, [activeId]);

  // Stop any in-progress recording if the user switches conversations
  useEffect(() => {
    if (recording) cancelRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Safety cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (callStatus === "connected") {
      setCallSeconds(0);
      callTimerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    } else if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callStatus]);

  async function sendToUser(targetId: string, event: string, payload: any) {
    const channel = supabase.channel(`calls:${targetId}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });
    await channel.send({ type: "broadcast", event, payload });
    setTimeout(() => supabase.removeChannel(channel), 500);
  }

  function endCall(notifyPeer = true) {
    if (notifyPeer && callPeer) sendToUser(callPeer.id, "hangup", {});
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
    setCallStatus("idle");
    setCallPeer(null);
    setIncomingOffer(null);
    setMicOn(true);
  }

  useEffect(() => {
    const channel = supabase.channel(`calls:${myProfile.id}`);
    channel
      .on("broadcast", { event: "offer" }, ({ payload }: any) => {
        if (payload.from === myProfile.id) return;
        setIncomingOffer(payload.offer);
        setCallPeer({
          id: payload.from,
          username: payload.fromUsername,
          display_name: payload.fromName,
          avatar_color: payload.fromColor,
          status: "",
          avatar_url: payload.fromAvatar,
        });
        setCallStatus("incoming");
      })
      .on("broadcast", { event: "answer" }, async ({ payload }: any) => {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        for (const c of pendingCandidatesRef.current) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        }
        pendingCandidatesRef.current = [];
        setCallStatus("connected");
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }: any) => {
        if (!pcRef.current) return;
        if (pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {}
        } else {
          pendingCandidatesRef.current.push(payload.candidate);
        }
      })
      .on("broadcast", { event: "hangup" }, () => {
        endCall(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myProfile.id, supabase]);

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${q.trim()}%`)
      .neq("id", myProfile.id)
      .limit(8);
    setSearchResults(data ?? []);
  }

  async function startConversation(other: Profile) {
    const { data: mine, error: mineError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", myProfile.id);

    if (mineError) {
      alert("Error reading my conversations: " + mineError.message);
      return;
    }

    const myIds = (mine ?? []).map((r) => r.conversation_id);

    if (myIds.length > 0) {
      const { data: theirs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", other.id)
        .in("conversation_id", myIds);

      if (theirs && theirs.length > 0) {
        setSearch("");
        setMobileTab("chats");
        setActiveId(theirs[0].conversation_id);
        return;
      }
    }

    const { data: convo, error } = await supabase
      .from("conversations")
      .insert({ is_group: false, created_by: myProfile.id })
      .select()
      .single();

    if (error || !convo) {
      alert("Error creating conversation: " + (error?.message ?? "unknown"));
      return;
    }

    const { error: partError } = await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: myProfile.id },
      { conversation_id: convo.id, user_id: other.id },
    ]);

    if (partError) {
      alert("Error adding participants: " + partError.message);
      return;
    }

    setSearch("");
    setMobileTab("chats");
    await loadConversations();
    setActiveId(convo.id);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const content = input.trim();
    if (!content || !activeId) return;

    setSending(true);
    setInput("");
    const replyTo = replyingTo;
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: activeId,
      sender_id: myProfile.id,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
      message_type: "text",
      reply_to_id: replyTo?.id ?? null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeId,
        sender_id: myProfile.id,
        content,
        message_type: "text",
        reply_to_id: replyTo?.id ?? null,
      })
      .select()
      .single();

    if (error || !inserted) {
      // Insert failed — remove the fake "sent" bubble and give the text back
      // to the user instead of silently losing it.
      console.error("sendMessage insert failed:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
      setReplyingTo(replyTo);
      alert("Message bhej nahi paya:\n" + (error?.message ?? "unknown error"));
      setSending(false);
      return;
    }

    // Replace the optimistic bubble with the real DB row (covers the case
    // where our own realtime INSERT event is delayed or missed entirely).
    setMessages((prev) => {
      if (prev.some((m) => m.id === (inserted as Message).id)) {
        return prev.filter((m) => m.id !== tempId);
      }
      return prev.map((m) => (m.id === tempId ? (inserted as Message) : m));
    });

    // Push notify the other participant (1:1 chats only for now).
    sendPushNotification({
      userId: active?.otherProfile?.id,
      title: myProfile.display_name,
      body: content,
      url: "/",
    });

    loadConversations();
    setSending(false);
  }

  // Shared insert for image / voice messages
  async function sendMediaMessage(opts: { type: "image" | "voice"; url: string; duration?: number }) {
    if (!activeId) return;
    const replyTo = replyingTo;
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: activeId,
      sender_id: myProfile.id,
      content: "",
      created_at: new Date().toISOString(),
      read_at: null,
      message_type: opts.type,
      media_url: opts.url,
      media_duration: opts.duration ?? null,
      reply_to_id: replyTo?.id ?? null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeId,
        sender_id: myProfile.id,
        content: "",
        message_type: opts.type,
        media_url: opts.url,
        media_duration: opts.duration ?? null,
        reply_to_id: replyTo?.id ?? null,
      })
      .select()
      .single();

    if (error || !inserted) {
      console.error("sendMediaMessage insert failed:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert("Media message bhej nahi paya:\n" + (error?.message ?? "unknown error"));
      return;
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === (inserted as Message).id)) {
        return prev.filter((m) => m.id !== tempId);
      }
      return prev.map((m) => (m.id === tempId ? (inserted as Message) : m));
    });

    // Push notify the other participant about the new media message.
    sendPushNotification({
      userId: active?.otherProfile?.id,
      title: myProfile.display_name,
      body: opts.type === "image" ? "📷 Photo" : "🎤 Voice message",
      url: "/",
    });

    loadConversations();
  }

  async function handleMediaFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId) return;

    if (file.size > MAX_IMAGE_BYTES) {
      alert("Image is too large — please pick one under 8MB.");
      return;
    }

    setUploadingMedia(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${activeId}/${myProfile.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      alert("Image upload failed: " + uploadError.message);
      setUploadingMedia(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    await sendMediaMessage({ type: "image", url: publicUrlData.publicUrl });
    setUploadingMedia(false);
  }

  async function startRecording() {
    if (!activeId || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const candidates = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/aac",
        "audio/ogg",
      ];
      const supportedType =
        candidates.find(
          (t) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(t)
        ) || "";

      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      recordingMimeTypeRef.current = recorder.mimeType || supportedType || "audio/webm";

      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;

      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      alert("Could not access microphone: " + (err?.message ?? "permission denied"));
    }
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setRecording(false);
    setRecordingSeconds(0);
  }

  async function stopAndSendRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const finalDuration = recordingSeconds;
    const mimeType = recordingMimeTypeRef.current || "audio/webm";

    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(audioChunksRef.current, { type: mimeType }));
      };
      recorder.stop();
    });

    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setRecording(false);
    setRecordingSeconds(0);

    if (!activeId || finalDuration < 1) return; // ignore accidental taps

    setUploadingMedia(true);

    const ext = mimeType.includes("mp4")
      ? "m4a"
      : mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("aac")
      ? "aac"
      : "webm";

    const path = `${activeId}/${myProfile.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, {
      cacheControl: "3600",
      contentType: mimeType,
    });

    if (uploadError) {
      alert("Voice note upload failed: " + uploadError.message);
      setUploadingMedia(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    await sendMediaMessage({ type: "voice", url: publicUrlData.publicUrl, duration: finalDuration });
    setUploadingMedia(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${myProfile.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", myProfile.id);

    if (updateError) {
      alert("Saving avatar failed: " + updateError.message);
      setUploading(false);
      return;
    }

    setMyProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
    setUploading(false);
  }

  async function saveDisplayName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === myProfile.display_name) return;
    const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", myProfile.id);
    if (error) {
      alert("Could not save name: " + error.message);
      return;
    }
    setMyProfile((prev) => ({ ...prev, display_name: trimmed }));
  }

  async function saveBio() {
    const trimmed = bioDraft.trim();
    if (trimmed === (myProfile.bio ?? "")) return;
    const { error } = await supabase.from("profiles").update({ bio: trimmed }).eq("id", myProfile.id);
    if (error) {
      alert("Could not save bio: " + error.message);
      return;
    }
    setMyProfile((prev) => ({ ...prev, bio: trimmed }));
  }

  // --- status / story helpers ---
  const loadStatuses = useCallback(async () => {
    const { data } = await supabase
      .from("statuses")
      .select("*, profile:profiles(*)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    setStatuses((data ?? []) as any);
  }, [supabase]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    const channel = supabase
      .channel("statuses-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, () => loadStatuses())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadStatuses]);

  useEffect(() => {
    supabase
      .from("status_views")
      .select("status_id")
      .eq("viewer_id", myProfile.id)
      .then(({ data }) => setMyViewedStatusIds(new Set((data ?? []).map((r: any) => r.status_id))));
  }, [myProfile.id, supabase, statuses.length]);

  const myStatuses = statuses.filter((s) => s.user_id === myProfile.id);
  const otherStatusesGrouped: Record<string, Status[]> = {};
  statuses
    .filter((s) => s.user_id !== myProfile.id)
    .forEach((s) => {
      otherStatusesGrouped[s.user_id] = [...(otherStatusesGrouped[s.user_id] ?? []), s];
    });

  function statusRingPropsFor(userId: string) {
    const list = userId === myProfile.id ? myStatuses : otherStatusesGrouped[userId] ?? [];
    if (list.length === 0) return { hasStatus: false, viewed: true };
    const allViewed = list.every((s) => myViewedStatusIds.has(s.id));
    return { hasStatus: true, viewed: allViewed };
  }

  async function markStatusViewed(statusId: string) {
    if (myViewedStatusIds.has(statusId)) return;
    setMyViewedStatusIds((prev) => new Set(prev).add(statusId));
    await supabase
      .from("status_views")
      .upsert({ status_id: statusId, viewer_id: myProfile.id }, { onConflict: "status_id,viewer_id", ignoreDuplicates: true });
  }

  async function handleStatusFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      alert("Image is too large — please pick one under 8MB.");
      return;
    }

    setUploadingStatus(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${myProfile.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(STATUS_MEDIA_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
    });

    if (uploadError) {
      alert("Status upload failed: " + uploadError.message);
      setUploadingStatus(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(STATUS_MEDIA_BUCKET).getPublicUrl(path);
    const { error } = await supabase.from("statuses").insert({ user_id: myProfile.id, media_url: publicUrlData.publicUrl });
    if (error) alert("Could not post status: " + error.message);

    setUploadingStatus(false);
    loadStatuses();
  }

  async function postTextStatus() {
    const trimmed = textStatusDraft.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("statuses").insert({
      user_id: myProfile.id,
      text_content: trimmed,
      bg_color: textStatusColor,
    });
    if (error) {
      alert("Could not post status: " + error.message);
      return;
    }
    setTextStatusDraft("");
    setShowTextStatusComposer(false);
    loadStatuses();
  }

  async function deleteStatus(id: string) {
    await supabase.from("statuses").delete().eq("id", id);
    closeStatusViewer();
    loadStatuses();
  }

  function openStatusViewer(userId: string) {
    setStatusViewerUserId(userId);
    setStatusViewerIndex(0);
  }

  function closeStatusViewer() {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusViewerUserId(null);
    setStatusViewerIndex(0);
  }

  function advanceStatus(dir: 1 | -1) {
    if (!statusViewerUserId) return;
    const list = statusViewerUserId === myProfile.id ? myStatuses : otherStatusesGrouped[statusViewerUserId] ?? [];
    const next = statusViewerIndex + dir;
    if (next < 0) return;
    if (next >= list.length) {
      closeStatusViewer();
      return;
    }
    setStatusViewerIndex(next);
  }

  useEffect(() => {
    if (!statusViewerUserId) return;
    const list = statusViewerUserId === myProfile.id ? myStatuses : otherStatusesGrouped[statusViewerUserId] ?? [];
    const current = list[statusViewerIndex];
    if (!current) {
      closeStatusViewer();
      return;
    }
    markStatusViewed(current.id);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      advanceStatus(1);
    }, STATUS_DURATION_MS);
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusViewerUserId, statusViewerIndex, statuses]);

  async function startCall() {
    if (!active?.otherProfile || callStatus !== "idle") return;
    const peer = active.otherProfile;

    setCallPeer(peer);
    setCallStatus("outgoing");

    // Let the other person know they have an incoming call, even if the
    // realtime broadcast doesn't reach them (e.g. app closed / backgrounded).
    sendPushNotification({
      userId: peer.id,
      title: myProfile.display_name,
      body: "Incoming call…",
      url: "/",
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (e) => setRemoteStream(e.streams[0]);
      pc.onicecandidate = (e) => {
        if (e.candidate) sendToUser(peer.id, "ice-candidate", { candidate: e.candidate.toJSON() });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendToUser(peer.id, "offer", {
        from: myProfile.id,
        fromName: myProfile.display_name,
        fromUsername: myProfile.username,
        fromColor: myProfile.avatar_color,
        fromAvatar: myProfile.avatar_url,
        offer,
      });
    } catch (err: any) {
      alert("Could not start call: " + (err?.message ?? "permission denied"));
      endCall(false);
    }
  }

  async function acceptCall() {
    if (!incomingOffer || !callPeer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (e) => setRemoteStream(e.streams[0]);
      pc.onicecandidate = (e) => {
        if (e.candidate) sendToUser(callPeer.id, "ice-candidate", { candidate: e.candidate.toJSON() });
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      for (const c of pendingCandidatesRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {}
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendToUser(callPeer.id, "answer", { answer });

      setCallStatus("connected");
    } catch (err: any) {
      alert("Could not join call: " + (err?.message ?? "permission denied"));
      declineCall();
    }
  }

  function declineCall() {
    endCall(true);
  }

  function toggleMic() {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  }

  function formatCallTime(s: number) {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  function messageById(id?: string | null) {
    if (!id) return null;
    return messages.find((m) => m.id === id) ?? null;
  }

  function previewForQuote(m: Message | null) {
    if (!m) return "Message";
    if (m.message_type === "image") return "📷 Photo";
    if (m.message_type === "voice") return "🎤 Voice message";
    return m.content;
  }

  // --- swipe-to-reply touch handlers ---
  function onBubbleTouchStart(e: React.TouchEvent, m: Message) {
    if (reactionPickerFor) setReactionPickerFor(null);
    swipeStartRef.current = { id: m.id, x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onBubbleTouchMove(e: React.TouchEvent, m: Message) {
    const start = swipeStartRef.current;
    if (!start || start.id !== m.id) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    // ignore mostly-vertical touches so scrolling still works
    if (Math.abs(dy) > Math.abs(dx)) return;
    const clamped = Math.max(0, Math.min(dx, SWIPE_REPLY_MAX));
    setSwipeState({ id: m.id, dx: clamped });
  }

  function onBubbleTouchEnd(m: Message) {
    const state = swipeState;
    swipeStartRef.current = null;
    setSwipeState(null);
    if (state && state.id === m.id && state.dx > SWIPE_REPLY_THRESHOLD) {
      setReplyingTo(m);
    }
  }

  const otherIsOnline = active?.otherProfile ? onlineIds.has(active.otherProfile.id) : false;
  const otherDisplayProfile = otherProfileFresh ?? active?.otherProfile ?? null;

  const activeStatusList = statusViewerUserId
    ? statusViewerUserId === myProfile.id
      ? myStatuses
      : otherStatusesGrouped[statusViewerUserId] ?? []
    : [];
  const activeStatusItem = activeStatusList[statusViewerIndex] ?? null;
  const activeStatusProfile =
    activeStatusItem?.profile ?? (statusViewerUserId === myProfile.id ? myProfile : active?.otherProfile) ?? null;

  return (
    <div
      className="relative flex w-full overflow-x-hidden bg-ink-900 text-[color:var(--color-text)]"
      style={{ height: "var(--app-height, 100dvh)" }}
    >
      <audio ref={remoteAudioRef} autoPlay />

      {callStatus !== "idle" && callPeer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0C12]">
          <div className="pointer-events-none absolute inset-0 bg-aurora" />

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Avatar
              name={callPeer.display_name}
              color={callPeer.avatar_color}
              size={120}
              avatarUrl={callPeer.avatar_url}
            />
            <p className="mt-5 flex items-center font-display text-xl font-bold text-white">
              {callPeer.display_name}
              {isVerified(callPeer.username) && <VerifiedBadge size={18} />}
            </p>
            <p className="mt-2 text-sm text-mist">
              {callStatus === "outgoing" && "Calling…"}
              {callStatus === "incoming" && "Incoming call…"}
              {callStatus === "connected" && formatCallTime(callSeconds)}
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-6 pb-12">
            {callStatus === "incoming" ? (
              <>
                <button
                  onClick={declineCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
                  aria-label="Decline"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  onClick={acceptCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white shadow-lg"
                  aria-label="Accept"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <>
                {callStatus === "connected" && (
                  <button
                    onClick={toggleMic}
                    className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg ${
                      micOn ? "bg-white/10" : "bg-white text-ink-900"
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => endCall(true)}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
                  aria-label="End call"
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Status viewer overlay */}
      {statusViewerUserId && activeStatusItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex gap-1 px-3 pt-3">
            {activeStatusList.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white"
                  style={{ width: i <= statusViewerIndex ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar
              name={activeStatusProfile?.display_name ?? ""}
              color={activeStatusProfile?.avatar_color ?? "#7C5CFF"}
              avatarUrl={activeStatusProfile?.avatar_url}
              size={36}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center text-sm font-semibold text-white">
                <span className="truncate">{activeStatusProfile?.display_name}</span>
                {isVerified(activeStatusProfile?.username) && <VerifiedBadge />}
              </p>
              <p className="text-xs text-white/60">{formatLastSeen(activeStatusItem.created_at)}</p>
            </div>
            {activeStatusItem.user_id === myProfile.id && (
              <button
                onClick={() => deleteStatus(activeStatusItem.id)}
                className="text-xs font-medium text-white/70 hover:text-white"
              >
                Delete
              </button>
            )}
            <button onClick={closeStatusViewer} className="px-2 text-xl leading-none text-white" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <button
              className="absolute left-0 top-0 z-10 h-full w-1/3"
              onClick={() => advanceStatus(-1)}
              aria-label="Previous status"
            />
            <button
              className="absolute right-0 top-0 z-10 h-full w-1/3"
              onClick={() => advanceStatus(1)}
              aria-label="Next status"
            />

            {activeStatusItem.media_url ? (
              <img src={activeStatusItem.media_url} alt="Status" className="max-h-full max-w-full object-contain" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center p-8"
                style={{ background: activeStatusItem.bg_color ?? "#7C5CFF" }}
              >
                <p className="break-words text-center text-2xl font-semibold text-white">
                  {activeStatusItem.text_content}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text status composer */}
      {showTextStatusComposer && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: textStatusColor }}>
          <div className="flex items-center justify-between px-4 py-4">
            <button
              onClick={() => {
                setShowTextStatusComposer(false);
                setTextStatusDraft("");
              }}
              className="text-xl text-white"
              aria-label="Cancel"
            >
              ✕
            </button>
            <button
              onClick={postTextStatus}
              disabled={!textStatusDraft.trim()}
              className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Post
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-8">
            <textarea
              autoFocus
              value={textStatusDraft}
              onChange={(e) => setTextStatusDraft(e.target.value.slice(0, 200))}
              placeholder="Type a status…"
              rows={4}
              className="w-full resize-none bg-transparent text-center text-2xl font-semibold text-white placeholder:text-white/60 outline-none"
            />
          </div>
          <div className="flex justify-center gap-3 pb-8">
            {STATUS_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setTextStatusColor(c)}
                className={`h-8 w-8 rounded-full transition ${textStatusColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-black/20" : ""}`}
                style={{ background: c }}
                aria-label={`Choose color ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      <aside
        className={`${
          activeId ? "hidden md:flex" : "flex"
        } w-full md:max-w-xs flex-col border-r border-black/5 dark:border-white/5 bg-ink-800/60`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-2xl font-bold">
            Aira<span className="text-gradient">Think</span>
          </span>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {mobileTab === "home" && (
            <div className="flex h-full flex-col overflow-y-auto px-8 pb-10 text-center">
              <style>{`
                @keyframes fadeUp {
                  from { opacity: 0; transform: translateY(18px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              <div className="flex flex-col items-center pt-10">
                <div className="glass animate-floatSlow mb-6 flex h-20 w-20 items-center justify-center rounded-3xl">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                      stroke="url(#homeGrad)"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <defs>
                      <linearGradient id="homeGrad" x1="3" y1="3" x2="21" y2="21">
                        <stop stopColor="#9C82FF" />
                        <stop offset="1" stopColor="#22D3B8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h2 className="font-display text-2xl font-bold">
                  Welcome to <span className="text-gradient">AiraThink</span>!
                </h2>
                <p className="mt-2 text-sm text-mist">Let&apos;s connect. Real conversations, real time.</p>
                <button
                  onClick={() => setMobileTab("search")}
                  className="mt-6 rounded-full bg-gradient-to-r from-violet to-violet-light px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet/30"
                >
                  Start a conversation
                </button>
                {conversations.length > 0 && (
                  <button
                    onClick={() => setMobileTab("chats")}
                    className="mt-3 text-xs font-medium text-mist transition hover:text-black dark:hover:text-white"
                  >
                    Or go to your chats →
                  </button>
                )}
              </div>

              <div className="mt-10 flex flex-col gap-3 text-left">
                {HOME_FEATURES.map((f, i) => (
                  <div
                    key={f.title}
                    className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 opacity-0"
                    style={{ animation: `fadeUp 0.6s ease-out ${0.15 + i * 0.12}s forwards` }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet/15 text-lg">
                      {f.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{f.title}</p>
                      <p className="text-xs text-mist">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mobileTab === "status" && (
            <div className="px-2 pb-4">
              <input
                ref={statusFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleStatusFilePick}
              />

              <div className="flex items-center gap-3 px-3 py-3">
                <div className="relative">
                  {myStatuses.length > 0 ? (
                    <button onClick={() => openStatusViewer(myProfile.id)}>
                      <StatusRing {...statusRingPropsFor(myProfile.id)}>
                        <Avatar
                          name={myProfile.display_name}
                          color={myProfile.avatar_color}
                          avatarUrl={myProfile.avatar_url}
                          size={64}
                        />
                      </StatusRing>
                    </button>
                  ) : (
                    <Avatar
                      name={myProfile.display_name}
                      color={myProfile.avatar_color}
                      avatarUrl={myProfile.avatar_url}
                      size={64}
                    />
                  )}
                  <button
                    onClick={() => statusFileInputRef.current?.click()}
                    disabled={uploadingStatus}
                    className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-800 bg-violet text-white disabled:opacity-50"
                    aria-label="Add photo status"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => (myStatuses.length > 0 ? openStatusViewer(myProfile.id) : setShowTextStatusComposer(true))}
                  className="flex-1 text-left"
                >
                  <p className="text-base font-semibold">My Status</p>
                  <p className="text-sm text-mist">
                    {uploadingStatus ? "Uploading…" : myStatuses.length > 0 ? "Tap to view" : "Tap to add a status update"}
                  </p>
                </button>
                <button
                  onClick={() => setShowTextStatusComposer(true)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-violet-light transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Aa
                </button>
              </div>

              {Object.keys(otherStatusesGrouped).length > 0 && (
                <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-mist/70">
                  Recent updates
                </p>
              )}

              {Object.entries(otherStatusesGrouped).map(([userId, list]) => {
                const p = list[0].profile;
                const latest = list[list.length - 1];
                const ring = statusRingPropsFor(userId);
                return (
                  <button
                    key={userId}
                    onClick={() => openStatusViewer(userId)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <StatusRing {...ring}>
                      <Avatar
                        name={p?.display_name ?? "Unknown"}
                        color={p?.avatar_color ?? "#7C5CFF"}
                        avatarUrl={p?.avatar_url}
                        size={64}
                      />
                    </StatusRing>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center truncate text-base font-semibold">
                        <span className="truncate">{p?.display_name ?? "Unknown"}</span>
                        {isVerified(p?.username) && <VerifiedBadge />}
                      </p>
                      <p className="text-sm text-mist">{formatLastSeen(latest.created_at)}</p>
                    </div>
                  </button>
                );
              })}

              {Object.keys(otherStatusesGrouped).length === 0 && myStatuses.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-mist">No status updates yet.</p>
              )}
            </div>
          )}

          {mobileTab === "chats" && (
            <div className="px-2 pb-4">
              {loadingConvos && <p className="px-3 py-2 text-xs text-mist">Loading…</p>}
              {!loadingConvos && conversations.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-mist">
                  No conversations yet. Tap Search to start one.
                </p>
              )}
              {conversations.map((c) => {
                const name = c.is_group ? c.name ?? "Group" : c.otherProfile?.display_name ?? "Unknown";
                const color = c.otherProfile?.avatar_color ?? "#7C5CFF";
                const online = c.otherProfile ? onlineIds.has(c.otherProfile.id) : false;
                const ring = c.otherProfile ? statusRingPropsFor(c.otherProfile.id) : { hasStatus: false, viewed: true };
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      activeId === c.id ? "bg-violet/15" : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <StatusRing {...ring}>
                      <Avatar name={name} color={color} online={online} avatarUrl={c.otherProfile?.avatar_url} size={56} />
                    </StatusRing>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center truncate text-lg font-semibold">
                        <span className="truncate">{name}</span>
                        {isVerified(c.otherProfile?.username) && <VerifiedBadge size={16} />}
                      </p>
                      <p className="truncate text-sm text-mist">{c.lastMessage}</p>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-teal px-1.5 text-xs font-bold text-[#0A0C12]">
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {mobileTab === "search" && (
            <div className="p-4">
              <input
                autoFocus
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by username…"
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-ink-800 px-3 py-2 text-sm placeholder:text-mist/50 focus:border-violet focus:outline-none"
              />
              <div className="mt-3">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => startConversation(r)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Avatar name={r.display_name} color={r.avatar_color} size={32} avatarUrl={r.avatar_url} />
                    <span className="inline-flex items-center">
                      {r.display_name}
                      {isVerified(r.username) && <VerifiedBadge />}
                      <span className="ml-1 text-mist">@{r.username}</span>
                    </span>
                  </button>
                ))}
                {search.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="px-2 py-2 text-xs text-mist">No users found.</p>
                )}
              </div>
            </div>
          )}

          {mobileTab === "profile" && (
            <div className="px-5 py-6">
              <h2 className="mb-6 text-center font-display text-lg font-bold">Edit Profile</h2>

              <div className="flex flex-col items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarPick}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative"
                  disabled={uploading}
                >
                  <Avatar
                    name={myProfile.display_name}
                    color={myProfile.avatar_color}
                    size={96}
                    avatarUrl={myProfile.avatar_url}
                  />
                  <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-800 bg-violet text-white shadow-lg">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
                        stroke="white"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="13" r="3" stroke="white" strokeWidth="1.6" />
                    </svg>
                  </span>
                </button>
                <p className="mt-2 text-xs text-mist">{uploading ? "Uploading…" : "Tap photo to change"}</p>
              </div>

              <div className="glass mt-6 divide-y divide-black/5 dark:divide-white/5 overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Full name</span>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="w-40 bg-transparent text-right text-sm outline-none"
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Email</span>
                  <span className="truncate text-sm">{myEmail || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Username</span>
                  <span className="inline-flex items-center text-sm">
                    @{myProfile.username}
                    {isVerified(myProfile.username) && <VerifiedBadge />}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="text-xs font-medium text-mist">Account</span>
                  <span className="text-sm font-medium text-red-400">Log out</span>
                </button>
              </div>

              <div className="glass mt-4 rounded-2xl px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-mist">Bio</span>
                  <span className="text-[10px] text-mist/70">
                    {bioDraft.length}/{MAX_BIO_LENGTH}
                  </span>
                </div>
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value.slice(0, MAX_BIO_LENGTH))}
                  placeholder="Write something about yourself…"
                  rows={3}
                  className="mt-2 w-full resize-none bg-transparent text-sm placeholder:text-mist/50 outline-none"
                />
              </div>

              <button
                onClick={() => {
                  saveDisplayName();
                  saveBio();
                }}
                disabled={
                  (!nameDraft.trim() || nameDraft.trim() === myProfile.display_name) &&
                  bioDraft.trim() === (myProfile.bio ?? "")
                }
                className="mt-6 w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-40"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 border-t border-black/5 dark:border-white/5 bg-ink-800/80">
          {(["home", "status", "chats", "search", "profile"] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex flex-col items-center gap-1.5 py-3.5 text-sm font-medium capitalize transition ${
                mobileTab === tab ? "text-violet-light" : "text-mist"
              }`}
            >
              <TabIcon tab={tab} />
              {tab}
            </button>
          ))}
        </div>
      </aside>

      <section className={`${activeId ? "flex" : "hidden md:flex"} relative min-w-0 flex-1 flex-col`}>
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-40" />

        {!active ? (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
            <div className="glass animate-floatSlow mb-6 flex h-20 w-20 items-center justify-center rounded-3xl">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"
                  stroke="#9C82FF"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold">Pick a conversation</h2>
            <p className="mt-1 max-w-xs text-sm text-mist">
              Or start a new one from Search — your messages sync in real time.
            </p>
          </div>
        ) : showContactInfo ? (
          <div className="relative z-10 flex flex-1 flex-col">
            <header className="glass flex items-center gap-3 border-b border-black/5 dark:border-white/5 px-4 py-4">
              <button
                onClick={() => setShowContactInfo(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
                aria-label="Back to chat"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p className="text-sm font-semibold">Contact info</p>
            </header>

            <div className="flex flex-1 flex-col items-center px-6 py-10 text-center">
              <Avatar
                name={active.is_group ? active.name ?? "Group" : otherDisplayProfile?.display_name ?? "Unknown"}
                color={otherDisplayProfile?.avatar_color ?? "#7C5CFF"}
                size={140}
                online={otherIsOnline}
                avatarUrl={otherDisplayProfile?.avatar_url}
              />
              <p className="mt-5 flex items-center font-display text-xl font-bold">
                {active.is_group ? active.name ?? "Group" : otherDisplayProfile?.display_name ?? "Unknown"}
                {isVerified(otherDisplayProfile?.username) && <VerifiedBadge size={18} />}
              </p>
              {!active.is_group && (
                <>
                  <p className="mt-1 text-sm text-mist">@{otherDisplayProfile?.username}</p>
                  <p className="mt-3 text-sm">
                    {otherIsOnline ? (
                      <span className="text-teal">Active now</span>
                    ) : otherDisplayProfile?.last_seen ? (
                      <span className="text-mist">Last seen {formatLastSeen(otherDisplayProfile.last_seen)}</span>
                    ) : null}
                  </p>
                  {otherDisplayProfile?.bio && (
                    <p className="mt-5 max-w-xs whitespace-pre-wrap text-sm text-[color:var(--color-text)]/80">
                      {otherDisplayProfile.bio}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <header className="glass relative z-10 flex items-center gap-3 border-b border-black/5 dark:border-white/5 px-4 py-4 md:px-6">
              <button
                onClick={() => setActiveId(null)}
                className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white md:hidden"
                aria-label="Back to conversations"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => setShowContactInfo(true)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Avatar
                  name={active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"}
                  color={active.otherProfile?.avatar_color ?? "#7C5CFF"}
                  online={otherIsOnline}
                  avatarUrl={active.otherProfile?.avatar_url}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center text-sm font-semibold">
                    <span className="truncate">{active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"}</span>
                    {isVerified(active.otherProfile?.username) && <VerifiedBadge />}
                  </p>
                  {!active.is_group && (
                    <p className="truncate text-xs text-mist">
                      {otherIsOnline ? (
                        <span className="text-teal">Active now</span>
                      ) : otherProfileFresh?.last_seen ? (
                        `Last seen ${formatLastSeen(otherProfileFresh.last_seen)}`
                      ) : (
                        `@${active.otherProfile?.username}`
                      )}
                    </p>
                  )}
                </div>
              </button>

              {!active.is_group && (
                <button
                  onClick={startCall}
                  disabled={callStatus !== "idle"}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet to-violet-light text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-40"
                  aria-label="Voice call"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </header>

            <div ref={scrollRef} onScroll={handleMessagesScroll} className="relative z-10 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-6 py-6">
              {loadingMore && <p className="pb-2 text-center text-xs text-mist">Loading older messages…</p>}
              {messages.map((m) => {
                const mine = m.sender_id === myProfile.id;
                const isImage = m.message_type === "image" && !!m.media_url;
                const isVoice = m.message_type === "voice" && !!m.media_url;
                const quoted = messageById(m.reply_to_id);
                const isSwiping = swipeState?.id === m.id;
                const translateX = isSwiping ? swipeState!.dx : 0;

                return (
                  <div
                    key={m.id}
                    className={`relative flex ${mine ? "justify-end" : "justify-start"}`}
                    onTouchStart={(e) => onBubbleTouchStart(e, m)}
                    onTouchMove={(e) => onBubbleTouchMove(e, m)}
                    onTouchEnd={() => onBubbleTouchEnd(m)}
                  >
                    {/* reply icon revealed while swiping */}
                    {isSwiping && translateX > 12 && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-violet-light"
                        style={{ opacity: Math.min(1, translateX / SWIPE_REPLY_THRESHOLD) }}
                      >
                        ↩
                      </span>
                    )}

                    <div
                      style={{
                        transform: `translateX(${translateX}px)`,
                        transition: isSwiping ? "none" : "transform 0.15s ease-out",
                      }}
                      className="max-w-[80%] md:max-w-md"
                      onDoubleClick={() => toggleReaction(m.id, "❤️")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setReactionPickerFor(reactionPickerFor === m.id ? null : m.id);
                      }}
                    >
                      {reactionPickerFor === m.id && (
                        <div
                          className={`mb-1 flex gap-1 rounded-full bg-ink-800 px-2 py-1 shadow-lg ${
                            mine ? "justify-end" : "justify-start"
                          }`}
                        >
                          {QUICK_EMOJIS.map((emo) => (
                            <button
                              key={emo}
                              onClick={() => toggleReaction(m.id, emo)}
                              className="text-lg leading-none hover:scale-110 transition"
                            >
                              {emo}
                            </button>
                          ))}
                        </div>
                      )}

                      <div
                        className={`text-sm ${
                          isImage ? "overflow-hidden rounded-2xl p-1" : "rounded-2xl px-4 py-2.5"
                        } ${
                          mine
                            ? `${isImage ? "" : "bg-gradient-to-br from-violet to-violet-dark"} rounded-br-sm text-white`
                            : `${isImage ? "" : "glass"} rounded-bl-sm text-[color:var(--color-text)]`
                        }`}
                      >
                        {quoted && (
                          <div
                            className={`mb-1.5 rounded-lg border-l-2 border-violet-light bg-black/25 px-2 py-1 text-xs ${
                              isImage ? "mx-2 mt-2" : ""
                            }`}
                          >
                            <p className="font-medium text-violet-light">
                              {quoted.sender_id === myProfile.id ? "You" : active.otherProfile?.display_name ?? "Message"}
                            </p>
                            <p className="truncate text-white/70">{previewForQuote(quoted)}</p>
                          </div>
                        )}

                        {isImage ? (
                          <img
                            src={m.media_url!}
                            alt="Shared photo"
                            className="max-h-72 w-full cursor-pointer rounded-xl object-cover"
                            onClick={() => window.open(m.media_url!, "_blank")}
                          />
                        ) : isVoice ? (
                          <VoiceMessage url={m.media_url!} duration={m.media_duration ?? 0} mine={mine} />
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        )}
                        <p
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                            mine ? "text-white/60" : "text-mist"
                          } ${isImage ? "px-2 pb-1" : ""}`}
                        >
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {mine && <Ticks read={!!m.read_at} />}
                        </p>
                      </div>

                      <ReactionPills
                        msgReactions={reactionsByMsg[m.id] ?? []}
                        myId={myProfile.id}
                        onToggle={(emoji) => toggleReaction(m.id, emoji)}
                      />
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="pt-10 text-center text-sm text-mist">No messages yet — say hello 👋</p>
              )}
            </div>

            {replyingTo && (
              <div className="relative z-10 flex items-center justify-between border-t border-black/5 dark:border-white/5 bg-ink-800/60 px-6 py-2">
                <div className="min-w-0 flex-1 border-l-2 border-violet-light pl-2">
                  <p className="text-xs font-medium text-violet-light">
                    Replying to {replyingTo.sender_id === myProfile.id ? "yourself" : active.otherProfile?.display_name ?? "message"}
                  </p>
                  <p className="truncate text-xs text-mist">{previewForQuote(replyingTo)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="ml-3 shrink-0 text-mist hover:text-black dark:hover:text-white"
                  aria-label="Cancel reply"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={sendMessage} className="relative z-10 flex items-center gap-3 border-t border-black/5 dark:border-white/5 px-6 py-4">
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMediaFilePick}
              />

              {recording ? (
                <div className="flex flex-1 items-center gap-3 rounded-full border border-red-400/30 bg-red-500/10 px-5 py-3">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-400" />
                  <span className="flex-1 text-sm text-[color:var(--color-text)]/80">Recording… {formatDuration(recordingSeconds)}</span>
                  <button type="button" onClick={cancelRecording} className="text-xs font-medium text-mist hover:text-black dark:hover:text-white">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white disabled:opacity-40"
                    aria-label="Send image"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </button>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                      }, 300);
                    }}
                    placeholder={uploadingMedia ? "Sending…" : replyingTo ? "Reply…" : "Type a message…"}
                    disabled={uploadingMedia}
                    className="min-w-0 flex-1 rounded-full border border-black/10 dark:border-white/10 bg-ink-800 px-5 py-3 text-sm placeholder:text-mist/50 focus:border-violet focus:outline-none disabled:opacity-60"
                  />
                </>
              )}

              {recording ? (
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet to-violet-light text-white shadow-lg shadow-violet/30"
                  aria-label="Send voice note"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : input.trim() ? (
                <button
                  type="submit"
                  disabled={sending}
                  className="shrink-0 rounded-full bg-gradient-to-r from-violet to-violet-light px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-50"
                >
                  Send
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={uploadingMedia}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-[color:var(--color-text)] transition hover:bg-black/10 dark:hover:bg-white/15 disabled:opacity-40"
                  aria-label="Record voice note"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
