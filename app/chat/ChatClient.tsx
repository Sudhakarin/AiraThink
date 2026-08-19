"use client";

import { useCallback, useEffect, useRef, useState, Fragment, useMemo, type UIEvent } from "react";
import { useRouter } from "next/navigation";
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
  edited_at?: string | null;
  is_forwarded?: boolean;
  original_message_id?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
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

type ConnectionRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_profile?: Profile;
};

type NewsArticle = {
  id: string;
  category: string;
  emoji: string;
  thumb_gradient: string;
  image_url?: string | null;  // <-- NEW: Added image_url field
  source_url?: string | null;
  title: string;
  source: string;
  read_time: string;
  body: string[];
  is_featured: boolean;
  created_at: string;
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
const NEWS_MEDIA_BUCKET = "news-media";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const QUICK_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];
const SWIPE_REPLY_THRESHOLD = 44;
const SWIPE_REPLY_MAX = 64;
const MAX_BIO_LENGTH = 160;
const STATUS_DURATION_MS = 5000;
const STATUS_COLORS = ["#7C5CFF", "#22D3B8", "#EF4444", "#F59E0B", "#3B82F6", "#EC4899", "#111827"];
const TYPING_IDLE_MS = 3000;
const TYPING_THROTTLE_MS = 2000;
const GROUPED_GAP_MS = 2 * 60 * 1000;
const POLL_INTERVAL_MS = 3000;
const ACTIVE_STATUS_STORAGE_KEY = "airathink-active-status";
const EDIT_TIMEOUT_MS = 300000; // 5 minutes

const HOME_FEATURES = [
  { icon: "🔒", title: "End-to-end encryption", desc: "Your messages stay private, always." },
  { icon: "⚡", title: "Realtime chat", desc: "Messages arrive instantly, no delay." },
  { icon: "⏳", title: "24 hours disappearing", desc: "Status updates vanish after a day." },
  { icon: "🆓", title: "Free to use", desc: "No subscriptions, no hidden costs." },
  { icon: "📶", title: "Works on all networks", desc: "Smooth on 3G, 4G, 5G and beyond." },
];

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
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
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
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

// Deterministic "engagement" view count for a news article.
// Same article always shows the same number (seeded from its id), so it
// doesn't jump around on every re-render / refresh.
function seededViewCount(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  // Range: ~800 to ~68,000 views
  return 800 + (positive % 67200);
}

function formatViewCount(n: number) {
  if (n >= 1000) {
    const k = n / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${rounded}K views`;
  }
  return `${n} views`;
}

function isVerified(username?: string) {
  return ["sudhakarin", "tanushree2251", "instagram", "shikhamishra", "manjumishra"].includes(username?.toLowerCase() || "");
}

function isAiraThinkSource(source?: string) {
  return (source || "").toLowerCase() === "airathink";
}

function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="ml-1 inline-block shrink-0 align-middle" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M12 1.8l2.2 1.6 2.8-.4 1.1 2.6 2.6 1.1-.4 2.8L22.2 12l-1.9 2.3.4 2.8-2.6 1.1-1.1 2.6-2.8-.4L12 22.2l-2.2-1.8-2.8.4-1.1-2.6-2.6-1.1.4-2.8L1.8 12l1.9-2.3-.4-2.8 2.6-1.1 1.1-2.6 2.8.4L12 1.8Z" 
        fill="white" 
      />
      <path 
        d="M7.6 12.1L10.4 14.9L16.6 8.7" 
        fill="none" 
        stroke="#111827" 
        strokeWidth="1.9" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

function Avatar({ name, color, size = 40, online = false, avatarUrl }: {
  name: string; color: string; size?: number; online?: boolean; avatarUrl?: string | null;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" style={{ width: size, height: size }} />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full font-display text-xs font-bold text-white" style={{ background: color }}>
          {initials(name)}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 rounded-full border-2 border-ink-900 bg-teal" style={{ width: size * 0.3, height: size * 0.3 }} />
      )}
    </div>
  );
}

function StatusRing({ hasStatus, viewed, children }: { hasStatus: boolean; viewed: boolean; children: React.ReactNode }) {
  if (!hasStatus) return <>{children}</>;
  return (
    <div className="rounded-full p-[2px]" style={{ background: viewed ? "#4B5563" : "linear-gradient(45deg, #7C5CFF, #22D3B8)" }}>
      <div className="rounded-full bg-ink-900 p-[2px]">{children}</div>
    </div>
  );
}

function Ticks({ read, className = "text-white" }: { read: boolean; className?: string }) {
  return read ? (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className={`inline-block align-middle ${className}`}>
      <path d="M1 5l3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5l3 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className={`inline-block align-middle ${className}`}>
      <path d="M1 5l3 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TabIcon({ tab, active = false }: { tab: MobileTab; active?: boolean }) {
  // Instagram-style: outline icon when inactive, solid/filled icon when active.
  if (tab === "home") return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.6 2.4 10.8a1 1 0 0 0 .65 1.76H4.5V20a1.5 1.5 0 0 0 1.5 1.5h4a1 1 0 0 0 1-1V15h2v5.5a1 1 0 0 0 1 1h4a1.5 1.5 0 0 0 1.5-1.5v-7.44h1.45a1 1 0 0 0 .65-1.76L12 2.6Z" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 11l8-7 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (tab === "status") return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.18" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </svg>
  );
  if (tab === "chats") return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
  if (tab === "search") return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" fill="currentColor" opacity="0.18" />
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
  return active ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VoiceMessage({ url, duration, mine, onDelete, isDeleted }: { 
  url: string; 
  duration: number; 
  mine: boolean;
  onDelete?: () => void;
  isDeleted?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveDuration, setLiveDuration] = useState(duration);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    const onTime = () => { if (audio.duration && isFinite(audio.duration)) setProgress(audio.currentTime / audio.duration); };
    const onLoaded = () => { if (audio.duration && isFinite(audio.duration)) setLiveDuration(audio.duration); };
    const onEnd = () => { setPlaying(false); setProgress(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, [speed]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); } else { audio.play(); setPlaying(true); }
  }

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  if (isDeleted) {
    return (
      <div className="flex min-w-[190px] items-center gap-2.5 py-0.5 opacity-50">
        <span className="text-sm text-mist">This message was deleted</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[190px] items-center gap-2.5 py-0.5">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <button type="button" onClick={toggle} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${mine ? "bg-white/20 hover:bg-white/30" : "bg-violet/20 hover:bg-violet/30"}`} aria-label={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z" /></svg>
        )}
      </button>
      <div className="flex-1">
        <div className={`h-1 w-full overflow-hidden rounded-full ${mine ? "bg-white/25" : "bg-black/15 dark:bg-white/15"}`}>
          <div className={`h-full rounded-full ${mine ? "bg-white" : "bg-violet-light"}`} style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      </div>
      <div className="relative">
        <button 
          type="button" 
          onClick={() => setShowSpeedMenu(!showSpeedMenu)} 
          className="shrink-0 text-[10px] font-medium tabular-nums text-mist hover:text-white transition"
        >
          {speed}x
        </button>
        {showSpeedMenu && (
          <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg bg-ink-800 p-1 shadow-xl">
            {speedOptions.map(s => (
              <button
                key={s}
                onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                className={`block w-full px-3 py-1 text-xs text-left hover:bg-white/5 rounded ${speed === s ? 'text-violet-light' : 'text-mist'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>
      <span className={`shrink-0 text-[10px] tabular-nums ${mine ? "text-white/70" : "text-mist"}`}>{formatDuration(liveDuration)}</span>
    </div>
  );
}

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

function ReactionPills({ msgReactions, myId, onToggle }: { msgReactions: Reaction[]; myId: string; onToggle: (emoji: string) => void; }) {
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
        <button key={emoji} onClick={() => onToggle(emoji)} className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition ${info.mine ? "bg-violet/30 ring-1 ring-violet-light" : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"}`}>
          <span>{emoji}</span>
          {info.count > 1 && <span className="text-[10px] text-[color:var(--color-text)]/70">{info.count}</span>}
        </button>
      ))}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start items-end gap-2">
      <div className="glass flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-mist/60" style={{ animation: "typingDot 1.4s ease-in-out infinite", animationDelay: "0s" }} />
        <span className="h-2 w-2 rounded-full bg-mist/60" style={{ animation: "typingDot 1.4s ease-in-out infinite", animationDelay: "0.2s" }} />
        <span className="h-2 w-2 rounded-full bg-mist/60" style={{ animation: "typingDot 1.4s ease-in-out infinite", animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}

function ErrorToast({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-red-500/90 px-4 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm">
      {msg}
    </div>
  );
}

function ActiveStatusSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label="Toggle Active Status"
      className="relative flex h-8 w-[58px] shrink-0 items-center rounded-full transition-colors duration-300"
      style={{
        background: on ? "linear-gradient(90deg, #22D3B8, #16A98C)" : "linear-gradient(90deg, #3A3550, #2A2540)",
        boxShadow: on
          ? "inset 0 0 0 1px rgba(0,0,0,0.06), 0 0 14px rgba(34,211,184,0.35)"
          : "inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      <span
        className="absolute flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white transition-all duration-300 ease-out"
        style={{
          top: 4,
          left: on ? 32 : 4,
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

export default function ChatClient({ profile: initialProfile }: { profile: Profile }) {
  const supabase = createClient();
  const router = useRouter();
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
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [selectedNewsCategory, setSelectedNewsCategory] = useState("For you");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishBody, setPublishBody] = useState("");
  const [publishCategory, setPublishCategory] = useState("India");
  const [publishImageUrl, setPublishImageUrl] = useState("");
  const [publishFeatured, setPublishFeatured] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [deletingArticle, setDeletingArticle] = useState(false);
  const [uploadingPublishImage, setUploadingPublishImage] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const [readerProgress, setReaderProgress] = useState(0);
  const [nameDraft, setNameDraft] = useState(initialProfile.display_name);
  const [bioDraft, setBioDraft] = useState(initialProfile.bio ?? "");
  const [uploading, setUploading] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPrependingRef = useRef(false);
  const realtimeConnectedRef = useRef(false);

  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsMessages, setSearchResultsMessages] = useState<Message[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());

  const lastMessageIdRef = useRef<string | null>(null);
  const lastMessageCreatedAtRef = useRef<string | null>(null);

  const [notifications, setNotifications] = useState<ConnectionRequest[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [connectPopupTarget, setConnectPopupTarget] = useState<Profile | null>(null);
  const [connectPopupMode, setConnectPopupMode] = useState<"ask" | "pending" | "declined" | null>(null);
  const [connectSending, setConnectSending] = useState(false);

  const [profileView, setProfileView] = useState<Profile | null>(null);
  const [profileViewStatus, setProfileViewStatus] = useState<"loading" | "none" | "pending" | "declined" | "connected" | null>(null);
  const [profileViewConvoId, setProfileViewConvoId] = useState<string | null>(null);
  const [profileViewConnCount, setProfileViewConnCount] = useState<number | null>(null);
  const [profileViewAnimCount, setProfileViewAnimCount] = useState(0);
  const [profileViewMutuals, setProfileViewMutuals] = useState<{ profiles: Profile[]; count: number }>({ profiles: [], count: 0 });

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, Reaction[]>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const swipeStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [swipeState, setSwipeState] = useState<{ id: string; dx: number } | null>(null);

  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeChannelRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingMimeTypeRef = useRef<string>("audio/webm");

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

  const [contactMuted, setContactMuted] = useState(false);
  const [contactBlocked, setContactBlocked] = useState(false);

  const [activeStatusOn, setActiveStatusOn] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ACTIVE_STATUS_STORAGE_KEY);
      if (stored === "off") setActiveStatusOn(false);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_STATUS_STORAGE_KEY, activeStatusOn ? "on" : "off");
    } catch {}
  }, [activeStatusOn]);

  function toggleActiveStatus() {
    setActiveStatusOn((v) => !v);
  }

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId]
  );

  useEffect(() => {
    if (!activeId) return;
    const loadPinned = async () => {
      const { data } = await supabase
        .from('message_pins')
        .select('message_id')
        .eq('conversation_id', activeId)
        .eq('user_id', myProfile.id);
      setPinnedMessages(new Set(data?.map(d => d.message_id) || []));
    };
    loadPinned();
  }, [activeId, myProfile.id, supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setMyEmail(data.user.email);
    });
  }, [supabase]);

  useEffect(() => {
    subscribeToPush(myProfile.id);
  }, [myProfile.id]);

  const loadConversations = useCallback(async () => {
    const { data: participantRows } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", myProfile.id);
    const convoIds = (participantRows ?? []).map((r) => r.conversation_id);
    if (convoIds.length === 0) { setConversations([]); setLoadingConvos(false); return; }

    const { data: convos } = await supabase.from("conversations").select("id, is_group, name").in("id", convoIds);
    const { data: otherParticipants } = await supabase.from("conversation_participants").select("conversation_id, user_id, profiles(*)").in("conversation_id", convoIds).neq("user_id", myProfile.id);
    const { data: lastMessages } = await supabase.from("messages").select("conversation_id, content, message_type, created_at, is_deleted").in("conversation_id", convoIds).order("created_at", { ascending: false });
    const { data: unreadRows } = await supabase.from("messages").select("id, conversation_id").in("conversation_id", convoIds).neq("sender_id", myProfile.id).is("read_at", null);

    const unreadCounts: Record<string, number> = {};
    (unreadRows ?? []).forEach((m: any) => { unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1; });

    const previewFor = (m: any) => {
      if (!m) return "Say hello 👋";
      if (m.is_deleted) return "This message was deleted";
      if (m.message_type === "image") return "📷 Photo";
      if (m.message_type === "voice") return "🎤 Voice message";
      return m.content;
    };

    const rows = (convos ?? []).map((c) => {
      const other = (otherParticipants ?? []).find((p) => p.conversation_id === c.id);
      const last = (lastMessages ?? []).find((m) => m.conversation_id === c.id);
      return { id: c.id, is_group: c.is_group, name: c.name, otherProfile: other?.profiles ?? null, lastMessage: previewFor(last), lastAt: last?.created_at ?? "", unreadCount: unreadCounts[c.id] ?? 0 };
    });

    rows.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    setConversations(rows as any);
    setLoadingConvos(false);
  }, [myProfile.id, supabase]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!realtimeConnectedRef.current) loadConversations();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const fetchNews = useCallback(async () => {
    setLoadingNews(true);
    const { data, error } = await supabase
      .from("news_articles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Failed to fetch news:", error.message);
      setLoadingNews(false);
      return;
    }

    setNewsArticles((data ?? []) as NewsArticle[]);
    setLoadingNews(false);
  }, [supabase]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const handlePublish = useCallback(async () => {
    setPublishError("");
    if (!publishTitle.trim() || !publishBody.trim()) {
      setPublishError("Title aur body dono zaroori hain.");
      return;
    }
    setPublishing(true);
    try {
      const isEditing = !!editingArticleId;
      const res = await fetch(isEditing ? `/api/publish/${editingArticleId}` : "/api/publish", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: publishTitle,
          body: publishBody,
          category: publishCategory,
          image_url: publishImageUrl || undefined,
          is_featured: publishFeatured,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPublishError(json.error || "Publish nahi ho paya.");
        return;
      }
      setPublishTitle("");
      setPublishBody("");
      setPublishImageUrl("");
      setPublishFeatured(true);
      setEditingArticleId(null);
      setShowPublishModal(false);
      if (activeArticle && isEditing) {
        setActiveArticle({ ...activeArticle, title: publishTitle, body: [publishBody], category: publishCategory, image_url: publishImageUrl || null, is_featured: publishFeatured });
      }
      await fetchNews();
    } catch {
      setPublishError("Network error — dubara try karo.");
    } finally {
      setPublishing(false);
    }
  }, [publishTitle, publishBody, publishCategory, publishImageUrl, publishFeatured, editingArticleId, activeArticle, fetchNews]);

  async function handlePublishImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setPublishError("Image is too large. Maximum size is 8 MB.");
      return;
    }
    setUploadingPublishImage(true);
    setPublishError("");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${myProfile?.id || "anon"}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(NEWS_MEDIA_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
    if (uploadError) {
      setUploadingPublishImage(false);
      setPublishError("Image upload nahi ho paya. Dubara try karo.");
      return;
    }
    const { data: publicUrlData } = supabase.storage.from(NEWS_MEDIA_BUCKET).getPublicUrl(path);
    setPublishImageUrl(publicUrlData.publicUrl);
    setUploadingPublishImage(false);
  }

  const openEditArticle = useCallback((article: NewsArticle) => {
    setEditingArticleId(article.id);
    setPublishTitle(article.title);
    setPublishBody(article.body?.[0] || "");
    setPublishCategory(article.category);
    setPublishImageUrl(article.image_url || "");
    setPublishFeatured(article.is_featured);
    setPublishError("");
    setShowPublishModal(true);
  }, []);

  const handleDeleteArticle = useCallback(async (id: string) => {
    setDeletingArticle(true);
    try {
      const res = await fetch(`/api/publish/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setPublishError(json.error || "Delete nahi ho paya.");
        return;
      }
      setConfirmDeleteId(null);
      setActiveArticle(null);
      await fetchNews();
    } catch {
      setPublishError("Network error — dubara try karo.");
    } finally {
      setDeletingArticle(false);
    }
  }, [fetchNews]);

  const openArticle = useCallback((article: NewsArticle) => {
    setActiveArticle(article);
    setReaderProgress(0);
  }, []);

  const closeArticle = useCallback(() => {
    setActiveArticle(null);
    setReaderProgress(0);
  }, []);

  const handleReaderScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? (el.scrollTop / max) * 100 : 0;
    setReaderProgress(Math.min(100, Math.max(0, pct)));
  }, []);

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("connection_requests")
      .select("*, from_profile:profiles!connection_requests_from_user_id_fkey(*)")
      .eq("to_user_id", myProfile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setNotifications((data ?? []) as any);
  }, [myProfile.id, supabase]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);
  useEffect(() => {
    const interval = setInterval(() => { loadNotifications(); }, 4000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    const channel = supabase
      .channel("connection-requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_requests", filter: `to_user_id=eq.${myProfile.id}` }, () => {
        loadNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myProfile.id, supabase, loadNotifications]);

  useEffect(() => {
    const channel = supabase
      .channel("my-new-conversation-participant")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "conversation_participants",
        filter: `user_id=eq.${myProfile.id}`,
      }, () => { loadConversations(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myProfile.id, supabase, loadConversations]);

  async function acceptRequest(req: ConnectionRequest) {
    await supabase.from("connection_requests").update({ status: "accepted" }).eq("id", req.id);
    const { data: existing } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", myProfile.id);
    const myConvoIds = (existing ?? []).map((r: any) => r.conversation_id);
    let convoId: string | null = null;
    if (myConvoIds.length > 0) {
      const { data: shared } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", req.from_user_id).in("conversation_id", myConvoIds);
      if (shared && shared.length > 0) convoId = shared[0].conversation_id;
    }
    if (!convoId) {
      const { data: convo } = await supabase.from("conversations").insert({ is_group: false, created_by: myProfile.id }).select().single();
      if (!convo) { loadNotifications(); setShowNotifications(false); return; }
      convoId = convo.id;
      await supabase.from("conversation_participants").insert([
        { conversation_id: convoId, user_id: myProfile.id },
        { conversation_id: convoId, user_id: req.from_user_id },
      ]);
    }
    await loadConversations();
    setActiveId(convoId);
    setMobileTab("chats");
    loadNotifications();
    setShowNotifications(false);
  }

  async function declineRequest(req: ConnectionRequest) {
    await supabase.from("connection_requests").update({ status: "declined" }).eq("id", req.id);
    loadNotifications();
  }

  useEffect(() => {
    const channel = supabase.channel("global-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== myProfile.id) loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        loadConversations();
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myProfile.id, supabase, loadConversations]);

  useEffect(() => {
    const channel = supabase.channel("presence:online", { config: { presence: { key: myProfile.id } } });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED" && activeStatusOn) await channel.track({ online_at: new Date().toISOString() });
    });
    return () => { supabase.removeChannel(channel); };
  }, [myProfile.id, supabase, activeStatusOn]);

  useEffect(() => {
    const update = () => { supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", myProfile.id).then(() => {}); };
    update();
    const interval = setInterval(update, 20000);
    return () => clearInterval(interval);
  }, [myProfile.id, supabase]);

  useEffect(() => {
    const otherId = active?.otherProfile?.id;
    if (!otherId) { setOtherProfileFresh(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", otherId).single();
      if (!cancelled) setOtherProfileFresh(data ?? null);
    })();
    return () => { cancelled = true; };
  }, [active?.otherProfile?.id, supabase]);

  const cancelRecordingRef = useRef<() => void>(() => {});

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") { recorder.onstop = null; recorder.stop(); }
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null; mediaRecorderRef.current = null; audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null; setRecording(false); setRecordingPaused(false); setRecordingSeconds(0); setRecordingDuration(0);
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    setRecordingPaused(true);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    setRecordingPaused(false);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  }

  useEffect(() => {
    cancelRecordingRef.current = cancelRecording;
  });

  const searchMessagesInChat = async (query: string) => {
    setSearchQuery(query);
    if (!activeId || query.length < 2) {
      setSearchResultsMessages([]);
      return;
    }
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeId)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);
    setSearchResultsMessages(data || []);
  };

  const togglePinMessage = async (messageId: string) => {
    const isPinned = pinnedMessages.has(messageId);
    if (isPinned) {
      await supabase.from('message_pins').delete()
        .eq('message_id', messageId)
        .eq('conversation_id', activeId)
        .eq('user_id', myProfile.id);
      setPinnedMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    } else {
      await supabase.from('message_pins').insert({
        message_id: messageId,
        conversation_id: activeId,
        user_id: myProfile.id
      });
      setPinnedMessages(prev => new Set(prev).add(messageId));
    }
  };

  const startEditMessage = (message: Message) => {
    if (message.sender_id !== myProfile.id) return;
    const timeSince = Date.now() - new Date(message.created_at).getTime();
    if (timeSince > EDIT_TIMEOUT_MS) {
      setErrorMsg("You can only edit messages within 5 minutes");
      return;
    }
    setEditingMessage(message);
    setEditContent(message.content);
  };

  const saveEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;
    const { error } = await supabase
      .from('messages')
      .update({ 
        content: editContent.trim(), 
        edited_at: new Date().toISOString() 
      })
      .eq('id', editingMessage.id)
      .eq('sender_id', myProfile.id);
    
    if (error) {
      setErrorMsg("Failed to edit message");
      return;
    }
    setEditingMessage(null);
    setEditContent("");
    setMessages(prev => prev.map(m => 
      m.id === editingMessage.id 
        ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() }
        : m
    ));
  };

  const deleteMessage = async (messageId: string, forEveryone: boolean) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    if (forEveryone) {
      if (message.sender_id !== myProfile.id) {
        setErrorMsg("You can only delete your own messages");
        return;
      }
      await supabase
        .from('messages')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', messageId);
    } else {
      await supabase
        .from('message_deletions')
        .insert({
          message_id: messageId,
          user_id: myProfile.id,
          deleted_at: new Date().toISOString()
        });
    }
    
    setMessages(prev => prev.map(m => 
      m.id === messageId 
        ? { ...m, is_deleted: forEveryone || message.sender_id === myProfile.id, deleted_at: new Date().toISOString() }
        : m
    ));
  };

  const forwardMessage = async (targetConversationId: string) => {
    if (!forwardingMessage) return;
    const { error } = await supabase.from('messages').insert({
      conversation_id: targetConversationId,
      sender_id: myProfile.id,
      content: forwardingMessage.content,
      message_type: forwardingMessage.message_type,
      media_url: forwardingMessage.media_url,
      is_forwarded: true,
      original_message_id: forwardingMessage.id
    });
    if (error) {
      setErrorMsg("Failed to forward message");
      return;
    }
    setShowForwardModal(false);
    setForwardingMessage(null);
    loadConversations();
  };

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setMessages([]); setHasMore(true); setReplyingTo(null); setReactionsByMsg({});
    setPeerTyping(false);
    lastMessageCreatedAtRef.current = null;
    lastMessageIdRef.current = null;

    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at", { ascending: false }).limit(PAGE_SIZE);
      if (cancelled) return;
      const ordered = (data ?? []).slice().reverse();
      setMessages(ordered);
      setHasMore((data ?? []).length === PAGE_SIZE);
      if (ordered.length > 0) {
        lastMessageCreatedAtRef.current = ordered[ordered.length - 1].created_at;
        lastMessageIdRef.current = ordered[ordered.length - 1].id;
      }
      loadReactionsFor(ordered.map((m) => m.id));
    })();

    const channel = supabase.channel(`messages:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
        setPeerTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        const incoming = payload.new as Message;
        lastMessageCreatedAtRef.current = incoming.created_at;
        lastMessageIdRef.current = incoming.id;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          const withoutTemp = prev.filter((m) => !(m.id.startsWith("temp-") && m.sender_id === incoming.sender_id && (m.content === incoming.content || (m.media_url && m.media_url === incoming.media_url))));
          return [...withoutTemp, incoming];
        });
        loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
        const updated = payload.new as Message;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        loadConversations();
      })
      .on("broadcast", { event: "typing" }, ({ payload }: any) => {
        if (!payload || payload.userId === myProfile.id) return;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (payload.typing === false) { setPeerTyping(false); return; }
        setPeerTyping(true);
        typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), TYPING_IDLE_MS);
      })
      .subscribe((status) => {
        realtimeConnectedRef.current = status === "SUBSCRIBED";
      });

    activeChannelRef.current = channel;

    const reactionsChannel = supabase.channel(`reactions:${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload: any) => {
        const row = (payload.new ?? payload.old) as Reaction | undefined;
        if (!row) return;
        setMessages((current) => { if (current.some((m) => m.id === row.message_id)) loadReactionsFor(current.map((m) => m.id)); return current; });
      })
      .subscribe();

    return () => {
      cancelled = true;
      realtimeConnectedRef.current = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(reactionsChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      activeChannelRef.current = null;
    };
  }, [activeId, supabase, loadConversations]);

  useEffect(() => {
    if (!activeId) return;
    const poll = async () => {
      if (realtimeConnectedRef.current) return;
      const since = lastMessageCreatedAtRef.current;
      let query = supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at", { ascending: true });
      if (since) {
        query = query.gt("created_at", since);
      } else {
        return;
      }
      const { data } = await query;
      if (!data || data.length === 0) return;
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newMsgs = data.filter((m: Message) => !existingIds.has(m.id));
        if (newMsgs.length === 0) return prev;
        const withoutTemps = prev.filter((m) => {
          if (!m.id.startsWith("temp-")) return true;
          return !newMsgs.some(
            (nm: Message) => nm.sender_id === m.sender_id && (nm.content === m.content || (nm.media_url && nm.media_url === m.media_url))
          );
        });
        return [...withoutTemps, ...newMsgs];
      });
      const latest = data[data.length - 1];
      lastMessageCreatedAtRef.current = latest.created_at;
      lastMessageIdRef.current = latest.id;
    };
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeId, supabase]);

  async function loadReactionsFor(messageIds: string[]) {
    if (messageIds.length === 0) return;
    const { data } = await supabase.from("message_reactions").select("*").in("message_id", messageIds);
    const grouped: Record<string, Reaction[]> = {};
    (data ?? []).forEach((r: Reaction) => { grouped[r.message_id] = [...(grouped[r.message_id] ?? []), r]; });
    setReactionsByMsg(grouped);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    setReactionPickerFor(null);
    const existing = reactionsByMsg[messageId]?.find((r) => r.user_id === myProfile.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", myProfile.id).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: myProfile.id, emoji });
      const targetMsg = messages.find((m) => m.id === messageId);
      if (targetMsg && targetMsg.sender_id !== myProfile.id) {
        sendPushNotification({ userId: targetMsg.sender_id, title: myProfile.display_name, body: `${emoji} reacted to your message`, url: "/" });
      }
    }
    loadReactionsFor(messages.map((m) => m.id));
  }

  useEffect(() => {
    if (isPrependingRef.current) { isPrependingRef.current = false; return; }
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!peerTyping) return;
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isNearBottom) {
      setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }, [peerTyping]);

  async function loadMoreMessages() {
    if (!activeId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeId).lt("created_at", oldest.created_at).order("created_at", { ascending: false }).limit(PAGE_SIZE);
    const older = (data ?? []).slice().reverse();
    if (older.length < PAGE_SIZE) setHasMore(false);
    if (older.length > 0) {
      const container = scrollRef.current;
      const prevHeight = container?.scrollHeight ?? 0;
      isPrependingRef.current = true;
      setMessages((prev) => [...older, ...prev]);
      loadReactionsFor(older.map((m) => m.id));
      requestAnimationFrame(() => { if (container) container.scrollTop = container.scrollHeight - prevHeight; });
    }
    setLoadingMore(false);
  }

  function handleMessagesScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 60) loadMoreMessages();
  }

  useEffect(() => {
    if (!activeId) return;
    const unreadIds = messages.filter((m) => m.sender_id !== myProfile.id && !m.read_at && !m.id.startsWith("temp-")).map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds).then(() => loadConversations());
  }, [messages, activeId, myProfile.id, supabase, loadConversations]);

  useEffect(() => { setShowContactInfo(false); }, [activeId]);

  useEffect(() => {
    if (recording) cancelRecordingRef.current();
  }, [activeId]);

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
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callStatus]);

  useEffect(() => {
    if (profileViewConnCount === null || profileViewConnCount === 0) { setProfileViewAnimCount(0); return; }
    let raf: number;
    const target = profileViewConnCount;
    const start = performance.now();
    const duration = 650;
    function step(now: number) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setProfileViewAnimCount(Math.floor(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
      else setProfileViewAnimCount(target);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [profileViewConnCount]);

  async function sendToUser(targetId: string, event: string, payload: any) {
    const channel = supabase.channel(`calls:${targetId}`);
    await new Promise<void>((resolve) => { channel.subscribe((status) => { if (status === "SUBSCRIBED") resolve(); }); });
    await channel.send({ type: "broadcast", event, payload });
    setTimeout(() => supabase.removeChannel(channel), 500);
  }

  function endCall(notifyPeer = true) {
    if (notifyPeer && callPeer) sendToUser(callPeer.id, "hangup", {});
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null); setRemoteStream(null);
    pendingCandidatesRef.current = [];
    setCallStatus("idle"); setCallPeer(null); setIncomingOffer(null); setMicOn(true);
  }

  useEffect(() => {
    const channel = supabase.channel(`calls:${myProfile.id}`);
    channel
      .on("broadcast", { event: "offer" }, ({ payload }: any) => {
        if (payload.from === myProfile.id) return;
        setIncomingOffer(payload.offer);
        setCallPeer({ id: payload.from, username: payload.fromUsername, display_name: payload.fromName, avatar_color: payload.fromColor, status: "", avatar_url: payload.fromAvatar });
        setCallStatus("incoming");
      })
      .on("broadcast", { event: "answer" }, async ({ payload }: any) => {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        for (const c of pendingCandidatesRef.current) { try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
        pendingCandidatesRef.current = [];
        setCallStatus("connected");
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }: any) => {
        if (!pcRef.current) return;
        if (pcRef.current.remoteDescription) { try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {} }
        else { pendingCandidatesRef.current.push(payload.candidate); }
      })
      .on("broadcast", { event: "hangup" }, () => { endCall(false); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myProfile.id, supabase]);

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles").select("*").ilike("username", `%${q.trim()}%`).neq("id", myProfile.id).limit(8);
    setSearchResults(data ?? []);
  }

  async function openConnectPopup(other: Profile) {
    const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", myProfile.id);
    const myIds = (mine ?? []).map((r) => r.conversation_id);
    if (myIds.length > 0) {
      const { data: theirs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", other.id).in("conversation_id", myIds);
      if (theirs && theirs.length > 0) {
        setSearch(""); setSearchResults([]); setMobileTab("chats"); setActiveId(theirs[0].conversation_id);
        return;
      }
    }
    const { data: existing } = await supabase.from("connection_requests").select("*").eq("from_user_id", myProfile.id).eq("to_user_id", other.id).maybeSingle();
    if (existing) {
      setConnectPopupTarget(other);
      if (existing.status === "pending") setConnectPopupMode("pending");
      else if (existing.status === "declined") setConnectPopupMode("declined");
      else setConnectPopupMode("ask");
      return;
    }
    setConnectPopupTarget(other);
    setConnectPopupMode("ask");
  }

  async function fetchAcceptedConnectionIds(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from("connection_requests")
      .select("from_user_id, to_user_id")
      .eq("status", "accepted")
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
    return (data ?? []).map((r: any) => (r.from_user_id === userId ? r.to_user_id : r.from_user_id));
  }

  async function openProfileView(other: Profile) {
    setProfileView(other);
    setProfileViewStatus("loading");
    setProfileViewConvoId(null);
    setProfileViewConnCount(null);
    setProfileViewAnimCount(0);
    setProfileViewMutuals({ profiles: [], count: 0 });

    fetchAcceptedConnectionIds(other.id).then(async (theirIds) => {
      setProfileViewConnCount(theirIds.length);
      const myIds = await fetchAcceptedConnectionIds(myProfile.id);
      const mutualIds = myIds.filter((id) => theirIds.includes(id));
      if (mutualIds.length > 0) {
        const { data: mutualProfiles } = await supabase.from("profiles").select("*").in("id", mutualIds.slice(0, 3));
        setProfileViewMutuals({ profiles: (mutualProfiles ?? []) as Profile[], count: mutualIds.length });
      }
    });

    const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", myProfile.id);
    const myConvoIds = (mine ?? []).map((r) => r.conversation_id);
    if (myConvoIds.length > 0) {
      const { data: theirs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", other.id).in("conversation_id", myConvoIds);
      if (theirs && theirs.length > 0) {
        setProfileViewStatus("connected");
        setProfileViewConvoId(theirs[0].conversation_id);
        return;
      }
    }
    const { data: existing } = await supabase.from("connection_requests").select("*").eq("from_user_id", myProfile.id).eq("to_user_id", other.id).maybeSingle();
    if (existing) {
      if (existing.status === "pending") setProfileViewStatus("pending");
      else if (existing.status === "declined") setProfileViewStatus("declined");
      else setProfileViewStatus("none");
      return;
    }
    setProfileViewStatus("none");
  }

  function closeProfileView() {
    setProfileView(null);
    setProfileViewStatus(null);
    setProfileViewConvoId(null);
    setProfileViewConnCount(null);
    setProfileViewMutuals({ profiles: [], count: 0 });
  }

  function goToProfileChat() {
    if (!profileViewConvoId) return;
    setSearch(""); setSearchResults([]);
    setActiveId(profileViewConvoId);
    setMobileTab("chats");
    closeProfileView();
  }

  async function confirmConnect() {
    if (!connectPopupTarget) return;
    setConnectSending(true);
    const { error } = await supabase.from("connection_requests").insert({ from_user_id: myProfile.id, to_user_id: connectPopupTarget.id });
    setConnectSending(false);
    if (error) { setConnectPopupMode(null); setConnectPopupTarget(null); return; }
    sendPushNotification({ userId: connectPopupTarget.id, title: myProfile.display_name, body: `${myProfile.display_name} wants to connect with you!`, url: "/" });
    if (profileView?.id === connectPopupTarget.id) { setProfileViewStatus("pending"); }
    setConnectPopupMode(null);
    setConnectPopupTarget(null);
    setSearch("");
    setSearchResults([]);
  }

  function closeConnectPopup() {
    setConnectPopupTarget(null);
    setConnectPopupMode(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInput(value);
    const channel = activeChannelRef.current;
    if (!channel) return;
    if (value.trim().length === 0) {
      channel.send({ type: "broadcast", event: "typing", payload: { userId: myProfile.id, typing: false } });
      lastTypingSentRef.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      channel.send({ type: "broadcast", event: "typing", payload: { userId: myProfile.id, typing: true } });
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const content = input.trim();
    if (!content || !activeId) return;
    setSending(true); setInput("");
    activeChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: myProfile.id, typing: false } });
    const replyTo = replyingTo; setReplyingTo(null);
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
      is_forwarded: false,
      is_deleted: false
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    const { data: inserted, error } = await supabase.from("messages").insert({ 
      conversation_id: activeId, 
      sender_id: myProfile.id, 
      content, 
      message_type: "text", 
      reply_to_id: replyTo?.id ?? null 
    }).select().single();
    if (error || !inserted) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content); setReplyingTo(replyTo);
      setErrorMsg("Failed to send message. Please try again.");
      setSending(false); return;
    }
    lastMessageCreatedAtRef.current = (inserted as Message).created_at;
    lastMessageIdRef.current = (inserted as Message).id;
    setMessages((prev) => {
      if (prev.some((m) => m.id === (inserted as Message).id)) return prev.filter((m) => m.id !== tempId);
      return prev.map((m) => (m.id === tempId ? (inserted as Message) : m));
    });
    sendPushNotification({ userId: active?.otherProfile?.id, title: myProfile.display_name, body: content, url: "/" });
    loadConversations();
    setSending(false);
  }

  async function sendMediaMessage(opts: { type: "image" | "voice"; url: string; duration?: number }) {
    if (!activeId) return;
    const replyTo = replyingTo; setReplyingTo(null);
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
      is_forwarded: false,
      is_deleted: false
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    const { data: inserted, error } = await supabase.from("messages").insert({ 
      conversation_id: activeId, 
      sender_id: myProfile.id, 
      content: "", 
      message_type: opts.type, 
      media_url: opts.url, 
      media_duration: opts.duration ?? null, 
      reply_to_id: replyTo?.id ?? null 
    }).select().single();
    if (error || !inserted) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setErrorMsg("Failed to send media. Please try again.");
      return;
    }
    lastMessageCreatedAtRef.current = (inserted as Message).created_at;
    lastMessageIdRef.current = (inserted as Message).id;
    setMessages((prev) => {
      if (prev.some((m) => m.id === (inserted as Message).id)) return prev.filter((m) => m.id !== tempId);
      return prev.map((m) => (m.id === tempId ? (inserted as Message) : m));
    });
    sendPushNotification({ userId: active?.otherProfile?.id, title: myProfile.display_name, body: opts.type === "image" ? "📷 Photo" : "🎤 Voice message", url: "/" });
    loadConversations();
  }

  async function handleMediaFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !activeId) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMsg("Image is too large. Maximum size is 8 MB.");
      return;
    }
    setUploadingMedia(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${activeId}/${myProfile.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
    if (uploadError) {
      setUploadingMedia(false);
      setErrorMsg("Upload failed. Please try again.");
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
      const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac", "audio/ogg"];
      const supportedType = candidates.find((t) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(t)) || "";
      const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);
      recordingMimeTypeRef.current = recorder.mimeType || supportedType || "audio/webm";
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true); setRecordingPaused(false); setRecordingSeconds(0); setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMsg("Microphone access denied. Please allow microphone permission.");
    }
  }

  async function stopAndSendRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const finalDuration = recordingDuration || recordingSeconds;
    const mimeType = recordingMimeTypeRef.current || "audio/webm";
    const blob: Blob = await new Promise((resolve) => { recorder.onstop = () => { resolve(new Blob(audioChunksRef.current, { type: mimeType })); }; recorder.stop(); });
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null; mediaRecorderRef.current = null; audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null; setRecording(false); setRecordingPaused(false); setRecordingSeconds(0); setRecordingDuration(0);
    if (!activeId || finalDuration < 1) return;
    setUploadingMedia(true);
    const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("aac") ? "aac" : "webm";
    const path = `${activeId}/${myProfile.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, { cacheControl: "3600", contentType: mimeType });
    if (uploadError) {
      setUploadingMedia(false);
      setErrorMsg("Voice upload failed. Please try again.");
      return;
    }
    const { data: publicUrlData } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    await sendMediaMessage({ type: "voice", url: publicUrlData.publicUrl, duration: finalDuration });
    setUploadingMedia(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login"); router.refresh();
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${myProfile.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true });
    if (uploadError) {
      setUploading(false);
      setErrorMsg("Avatar upload failed. Please try again.");
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", myProfile.id);
    if (updateError) {
      setUploading(false);
      setErrorMsg("Failed to update avatar. Please try again.");
      return;
    }
    setMyProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
    setUploading(false);
  }

  async function saveDisplayName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === myProfile.display_name) return;
    const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("id", myProfile.id);
    if (error) { setErrorMsg("Failed to save name. Please try again."); return; }
    setMyProfile((prev) => ({ ...prev, display_name: trimmed }));
  }

  async function saveBio() {
    const trimmed = bioDraft.trim();
    if (trimmed === (myProfile.bio ?? "")) return;
    const { error } = await supabase.from("profiles").update({ bio: trimmed }).eq("id", myProfile.id);
    if (error) { setErrorMsg("Failed to save bio. Please try again."); return; }
    setMyProfile((prev) => ({ ...prev, bio: trimmed }));
  }

  const loadStatuses = useCallback(async () => {
    const { data } = await supabase.from("statuses").select("*, profile:profiles(*)").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true });
    setStatuses((data ?? []) as any);
  }, [supabase]);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  useEffect(() => {
    const channel = supabase.channel("statuses-realtime").on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, () => loadStatuses()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, loadStatuses]);

  useEffect(() => {
    supabase.from("status_views").select("status_id").eq("viewer_id", myProfile.id)
      .then(({ data }) => setMyViewedStatusIds(new Set((data ?? []).map((r: any) => r.status_id))));
  }, [myProfile.id, supabase, statuses.length]);

  const myStatuses = statuses.filter((s) => s.user_id === myProfile.id);
  const otherStatusesGrouped: Record<string, Status[]> = {};
  statuses.filter((s) => s.user_id !== myProfile.id).forEach((s) => { otherStatusesGrouped[s.user_id] = [...(otherStatusesGrouped[s.user_id] ?? []), s]; });

  function statusRingPropsFor(userId: string) {
    const list = userId === myProfile.id ? myStatuses : otherStatusesGrouped[userId] ?? [];
    if (list.length === 0) return { hasStatus: false, viewed: true };
    const allViewed = list.every((s) => myViewedStatusIds.has(s.id));
    return { hasStatus: true, viewed: allViewed };
  }

  async function markStatusViewed(statusId: string) {
    if (myViewedStatusIds.has(statusId)) return;
    setMyViewedStatusIds((prev) => new Set(prev).add(statusId));
    await supabase.from("status_views").upsert({ status_id: statusId, viewer_id: myProfile.id }, { onConflict: "status_id,viewer_id", ignoreDuplicates: true });
  }

  async function handleStatusFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMsg("Image is too large. Maximum size is 8 MB.");
      return;
    }
    setUploadingStatus(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${myProfile.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(STATUS_MEDIA_BUCKET).upload(path, file, { cacheControl: "3600", contentType: file.type || undefined });
    if (uploadError) {
      setUploadingStatus(false);
      setErrorMsg("Status upload failed. Please try again.");
      return;
    }
    const { data: publicUrlData } = supabase.storage.from(STATUS_MEDIA_BUCKET).getPublicUrl(path);
    const { error } = await supabase.from("statuses").insert({ user_id: myProfile.id, media_url: publicUrlData.publicUrl });
    if (error) { setErrorMsg("Failed to post status. Please try again."); }
    setUploadingStatus(false); loadStatuses();
  }

  async function postTextStatus() {
    const trimmed = textStatusDraft.trim(); if (!trimmed) return;
    const { error } = await supabase.from("statuses").insert({ user_id: myProfile.id, text_content: trimmed, bg_color: textStatusColor });
    if (error) { setErrorMsg("Failed to post status. Please try again."); return; }
    setTextStatusDraft(""); setShowTextStatusComposer(false); loadStatuses();
  }

  async function deleteStatus(id: string) {
    await supabase.from("statuses").delete().eq("id", id);
    closeStatusViewer(); loadStatuses();
  }

  function openStatusViewer(userId: string) { setStatusViewerUserId(userId); setStatusViewerIndex(0); }
  function closeStatusViewer() { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); setStatusViewerUserId(null); setStatusViewerIndex(0); }

  function advanceStatus(dir: 1 | -1) {
    if (!statusViewerUserId) return;
    const list = statusViewerUserId === myProfile.id ? myStatuses : otherStatusesGrouped[statusViewerUserId] ?? [];
    const next = statusViewerIndex + dir;
    if (next < 0) return;
    if (next >= list.length) { closeStatusViewer(); return; }
    setStatusViewerIndex(next);
  }

  useEffect(() => {
    if (!statusViewerUserId) return;
    const list = statusViewerUserId === myProfile.id ? myStatuses : otherStatusesGrouped[statusViewerUserId] ?? [];
    const current = list[statusViewerIndex];
    if (!current) { closeStatusViewer(); return; }
    markStatusViewed(current.id);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => { advanceStatus(1); }, STATUS_DURATION_MS);
    return () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); };
  }, [statusViewerUserId, statusViewerIndex, statuses]);

  async function startCall() {
    if (!active?.otherProfile || callStatus !== "idle") return;
    const peer = active.otherProfile;
    setCallPeer(peer); setCallStatus("outgoing");
    sendPushNotification({ userId: peer.id, title: myProfile.display_name, body: "Incoming call…", url: "/" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (e) => setRemoteStream(e.streams[0]);
      pc.onicecandidate = (e) => { if (e.candidate) sendToUser(peer.id, "ice-candidate", { candidate: e.candidate.toJSON() }); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendToUser(peer.id, "offer", { from: myProfile.id, fromName: myProfile.display_name, fromUsername: myProfile.username, fromColor: myProfile.avatar_color, fromAvatar: myProfile.avatar_url, offer });
    } catch (err: any) {
      endCall(false);
      setErrorMsg("Could not access microphone to start call.");
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
      pc.onicecandidate = (e) => { if (e.candidate) sendToUser(callPeer.id, "ice-candidate", { candidate: e.candidate.toJSON() }); };
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      for (const c of pendingCandidatesRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendToUser(callPeer.id, "answer", { answer });
      setCallStatus("connected");
    } catch (err: any) {
      declineCall();
      setErrorMsg("Could not connect the call. Please try again.");
    }
  }

  function declineCall() { endCall(true); }
  function toggleMic() { localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn)); setMicOn((v) => !v); }
  function formatCallTime(s: number) { const m = Math.floor(s / 60).toString().padStart(2, "0"); const sec = (s % 60).toString().padStart(2, "0"); return `${m}:${sec}`; }
  function messageById(id?: string | null) { if (!id) return null; return messages.find((m) => m.id === id) ?? null; }
  function previewForQuote(m: Message | null) { 
    if (!m) return "Message"; 
    if (m.is_deleted) return "This message was deleted";
    if (m.message_type === "image") return "📷 Photo"; 
    if (m.message_type === "voice") return "🎤 Voice message"; 
    return m.content; 
  }

  function onBubbleTouchStart(e: React.TouchEvent, m: Message) {
    if (reactionPickerFor) setReactionPickerFor(null);
    swipeStartRef.current = { id: m.id, x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onBubbleTouchMove(e: React.TouchEvent, m: Message) {
    const start = swipeStartRef.current;
    if (!start || start.id !== m.id) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    const clamped = Math.max(0, Math.min(dx, SWIPE_REPLY_MAX));
    setSwipeState({ id: m.id, dx: clamped });
  }
  function onBubbleTouchEnd(m: Message) {
    const state = swipeState;
    swipeStartRef.current = null; setSwipeState(null);
    if (state && state.id === m.id && state.dx > SWIPE_REPLY_THRESHOLD) setReplyingTo(m);
  }

  const otherIsOnline = active?.otherProfile ? onlineIds.has(active.otherProfile.id) : false;
  const otherDisplayProfile = otherProfileFresh ?? active?.otherProfile ?? null;
  const activeStatusList = statusViewerUserId ? (statusViewerUserId === myProfile.id ? myStatuses : otherStatusesGrouped[statusViewerUserId] ?? []) : [];
  const activeStatusItem = activeStatusList[statusViewerIndex] ?? null;
  const activeStatusProfile = activeStatusItem?.profile ?? (statusViewerUserId === myProfile.id ? myProfile : active?.otherProfile) ?? null;

  return (
    <div
      className="relative flex w-full overflow-x-hidden bg-ink-900 text-white"
      style={{
        height: "var(--app-height, 100dvh)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0px); }
          30% { opacity: 1; transform: translateY(-5px); }
        }
        @keyframes ciSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-floatSlow { animation: floatSlow 4s ease-in-out infinite; }
      `}</style>
      <audio ref={remoteAudioRef} autoPlay />

      {errorMsg && <ErrorToast msg={errorMsg} onDismiss={() => setErrorMsg(null)} />}

      {/* ============ NEW: ARTICLE READER MODAL ============ */}
      {activeArticle && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-ink-900">
          {/* Progress bar */}
          <div className="h-0.5 w-full bg-white/10">
            <div className="h-full bg-violet-light" style={{ width: `${readerProgress}%` }} />
          </div>
          
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 bg-ink-900/95 border-b border-white/5">
            <button 
              onClick={closeArticle} 
              className="flex h-9 w-9 items-center justify-center rounded-full text-mist hover:bg-white/5 hover:text-white"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="flex items-center text-xs text-mist">
                {activeArticle.source}
                {isAiraThinkSource(activeArticle.source) && <VerifiedBadge size={13} />}
              </span>
              <span className="text-xs text-mist">·</span>
              <span className="text-xs text-mist">{activeArticle.read_time}</span>
            </div>
            <div className="flex items-center gap-1">
              {isAiraThinkSource(activeArticle.source) && myEmail && myEmail.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase() && (
                <>
                  <button
                    onClick={() => openEditArticle(activeArticle)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-mist hover:bg-white/5 hover:text-white"
                    aria-label="Edit article"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(activeArticle.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-mist hover:bg-white/5 hover:text-red-400"
                    aria-label="Delete article"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}
              <button 
                onClick={() => {
                  // Share article
                  if (navigator.share) {
                    navigator.share({
                      title: activeArticle.title,
                      text: activeArticle.title,
                      url: window.location.href,
                    });
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-mist hover:bg-white/5 hover:text-white"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </header>
          
          {/* Article content */}
          <div 
            className="flex-1 overflow-y-auto px-6 py-8"
            onScroll={handleReaderScroll}
          >
            <div className="mx-auto max-w-2xl">
              {/* Category badge */}
              <span className="inline-block rounded-full bg-violet/20 px-3 py-1 text-xs font-semibold text-violet-light">
                {activeArticle.category}
              </span>
              
              {/* Title */}
              <h1 className="mt-4 font-display text-2xl font-bold text-white leading-tight">
                {activeArticle.title}
              </h1>
              
              {/* Metadata */}
              <div className="mt-3 flex items-center gap-3 text-sm text-mist">
                <span className="flex items-center">
                  {activeArticle.source}
                  {isAiraThinkSource(activeArticle.source) && <VerifiedBadge size={14} />}
                </span>
                <span>·</span>
                <span>{activeArticle.read_time}</span>
                <span>·</span>
                <span>{new Date(activeArticle.created_at).toLocaleDateString()}</span>
                <span>·</span>
                <span className="text-teal">{formatViewCount(seededViewCount(activeArticle.id))}</span>
              </div>
              
              {/* Feature image - NEW: Now shows actual image if available */}
              <div className="mt-6 h-48 w-full rounded-2xl overflow-hidden flex items-center justify-center bg-ink-800">
                {activeArticle.image_url ? (
                  <img 
                    src={activeArticle.image_url} 
                    alt={activeArticle.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span 
                    className="flex h-full w-full items-center justify-center text-6xl"
                    style={{ background: activeArticle.thumb_gradient }}
                  >
                    {activeArticle.emoji}
                  </span>
                )}
              </div>
              
              {/* Body content */}
              <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-white/80">
                {activeArticle.body.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              {/* Read full story link — RSS only provides a summary, full article is on the source site */}
              {activeArticle.source_url && (
                <a
                  href={activeArticle.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet to-violet-light px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet/30"
                >
                  Read full story on {activeArticle.source}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M7 17L17 7M17 7H9M17 7v8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ============ END ARTICLE READER MODAL ============ */}

      {/* Edit Message Modal */}
      {editingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-ink-800 p-6">
            <h3 className="mb-2 font-semibold text-white">Edit Message</h3>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet"
              rows={3}
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditingMessage(null)} className="flex-1 rounded-full border border-white/10 py-2 text-sm text-mist hover:bg-white/5">
                Cancel
              </button>
              <button onClick={saveEditMessage} className="flex-1 rounded-full bg-violet py-2 text-sm text-white">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {showForwardModal && forwardingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-ink-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Forward to</h3>
              <button onClick={() => { setShowForwardModal(false); setForwardingMessage(null); }} className="text-mist hover:text-white">
                ✕
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {conversations.filter(c => c.id !== activeId).map(c => (
                <button
                  key={c.id}
                  onClick={() => forwardMessage(c.id)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-white/5"
                >
                  <Avatar 
                    name={c.otherProfile?.display_name || 'Unknown'} 
                    color={c.otherProfile?.avatar_color || '#7C5CFF'} 
                    size={36}
                  />
                  <span className="text-sm text-white">{c.otherProfile?.display_name || 'Unknown'}</span>
                </button>
              ))}
              {conversations.filter(c => c.id !== activeId).length === 0 && (
                <p className="text-center text-sm text-mist">No other conversations to forward to</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="mx-auto max-w-2xl bg-ink-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">Search Messages</h3>
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResultsMessages([]); }} className="text-mist hover:text-white">
                ✕
              </button>
            </div>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => searchMessagesInChat(e.target.value)}
              placeholder="Search in this chat..."
              className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-violet"
            />
            <div className="mt-4 max-h-96 overflow-y-auto">
              {searchResultsMessages.length > 0 ? (
                searchResultsMessages.map(msg => (
                  <div key={msg.id} className="rounded-lg p-3 text-sm hover:bg-white/5">
                    <p className={msg.is_deleted ? 'text-mist italic' : 'text-white'}>
                      {msg.is_deleted ? 'This message was deleted' : msg.content}
                    </p>
                    <p className="mt-1 text-xs text-mist">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : searchQuery.length >= 2 ? (
                <p className="text-center text-sm text-mist">No messages found</p>
              ) : (
                <p className="text-center text-sm text-mist">Type at least 2 characters to search</p>
              )}
            </div>
          </div>
        </div>
      )}

      {profileView && (
        <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-ink-900">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full opacity-25"
            style={{ background: `radial-gradient(circle, ${profileView.avatar_color ?? "#7C5CFF"} 0%, transparent 70%)` }}
          />
          <header className="relative z-10 flex items-center justify-between px-4 py-4">
            <button onClick={closeProfileView} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-mist transition hover:bg-white/10 hover:text-white" aria-label="Back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <p className="text-sm font-semibold text-white/70 tx2">@{profileView.username}</p>
            <span className="h-9 w-9" />
          </header>
          <div className="relative z-10 flex flex-col items-center px-6 pt-2 pb-6 text-center" style={{ animation: "ciSlideUp 0.3s ease-out forwards" }}>
            <div className="relative">
              <div className="rounded-full p-[3px]" style={{ background: onlineIds.has(profileView.id) ? "linear-gradient(135deg, #7C5CFF, #22D3B8)" : "rgba(255,255,255,0.12)" }}>
                <div className="rounded-full bg-ink-900 p-[3px]">
                  <Avatar name={profileView.display_name} color={profileView.avatar_color} avatarUrl={profileView.avatar_url} size={104} />
                </div>
              </div>
              {onlineIds.has(profileView.id) && (
                <span className="absolute bottom-2 right-2 h-4 w-4 rounded-full border-[3px] border-ink-900 bg-teal" />
              )}
            </div>
            <h2 className="mt-4 flex items-center font-display text-xl font-bold text-white tx1">
              {profileView.display_name}
              {isVerified(profileView.username) && <VerifiedBadge size={18} />}
            </h2>
            <p className="text-sm text-white/40 tx2">@{profileView.username}</p>
            <div
              className="mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1"
              style={{
                borderColor: onlineIds.has(profileView.id) ? "rgba(34,211,184,0.28)" : "rgba(255,255,255,0.1)",
                background: onlineIds.has(profileView.id) ? "rgba(34,211,184,0.08)" : "rgba(255,255,255,0.04)",
              }}
            >
              <span className="relative flex h-2 w-2">
                {onlineIds.has(profileView.id) && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-teal opacity-60" />
                )}
                <span className="relative h-2 w-2 rounded-full" style={{ background: onlineIds.has(profileView.id) ? "#22D3B8" : "rgba(255,255,255,0.3)" }} />
              </span>
              <span className="text-[11.5px] font-medium" style={{ color: onlineIds.has(profileView.id) ? "#22D3B8" : "rgba(255,255,255,0.45)" }}>
                {onlineIds.has(profileView.id) ? "Active now" : profileView.last_seen ? `Last seen ${formatLastSeen(profileView.last_seen)}` : "Offline"}
              </span>
            </div>
            <div className="mt-5 flex items-center gap-8">
              <div className="flex flex-col items-center">
                <span className="text-[17px] font-bold text-white tx1 tabular-nums">{profileViewConnCount === null ? "—" : profileViewAnimCount}</span>
                <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-white/40 tx2">Connection{profileViewConnCount === 1 ? "" : "s"}</span>
              </div>
              <div className="h-8 w-px bg-white/8" />
              <div className="flex flex-col items-center">
                <span className="text-[17px] font-bold text-white tx1 tabular-nums">{statuses.filter((s) => s.user_id === profileView.id).length}</span>
                <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-white/40 tx2">Updates</span>
              </div>
            </div>
            {profileView.bio && (
              <p className="mt-4 max-w-xs whitespace-pre-wrap text-sm leading-relaxed text-white/60 tx2">{profileView.bio}</p>
            )}
            {profileViewMutuals.count > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {profileViewMutuals.profiles.map((p) => (
                    <div key={p.id} className="rounded-full border-2 border-ink-900">
                      <Avatar name={p.display_name} color={p.avatar_color} avatarUrl={p.avatar_url} size={24} />
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-white/40 tx2">
                  Connected with <span className="text-white/70 tx2">{profileViewMutuals.profiles.map((p) => p.display_name).join(", ")}</span>
                  {profileViewMutuals.count > profileViewMutuals.profiles.length ? ` +${profileViewMutuals.count - profileViewMutuals.profiles.length}` : ""}
                </p>
              </div>
            )}
          </div>
          <div className="relative z-10 flex gap-3 px-6 pb-8">
            {profileViewStatus === "loading" && (
              <div className="flex flex-1 items-center justify-center rounded-full border border-white/10 bg-white/5 py-3 text-sm font-semibold text-mist">Checking…</div>
            )}
            {profileViewStatus === "none" && (
              <button onClick={() => { setConnectPopupTarget(profileView); setConnectPopupMode("ask"); }} className="flex-1 rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50">Connect</button>
            )}
            {profileViewStatus === "pending" && (
              <button disabled className="flex-1 rounded-full border border-white/10 bg-white/5 py-3 text-sm font-semibold text-mist">Request Sent</button>
            )}
            {profileViewStatus === "declined" && (
              <button onClick={() => { setConnectPopupTarget(profileView); setConnectPopupMode("declined"); }} className="flex-1 rounded-full border border-red-500/25 bg-red-500/10 py-3 text-sm font-semibold text-red-400">Request Declined</button>
            )}
            {profileViewStatus === "connected" && (
              <button onClick={goToProfileChat} className="flex-1 rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50">Message</button>
            )}
          </div>
        </div>
      )}

      {connectPopupTarget && connectPopupMode && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-800 p-6 shadow-2xl">
            <div className="flex flex-col items-center gap-3 pb-5">
              <Avatar name={connectPopupTarget.display_name} color={connectPopupTarget.avatar_color} size={72} avatarUrl={connectPopupTarget.avatar_url} />
              <div className="text-center">
                <p className="flex items-center justify-center font-display text-lg font-bold text-white">
                  {connectPopupTarget.display_name}
                  {isVerified(connectPopupTarget.username) && <VerifiedBadge size={16} />}
                </p>
                <p className="text-sm text-mist">@{connectPopupTarget.username}</p>
              </div>
            </div>
            <div className="mb-6 h-px w-full bg-white/10" />
            {connectPopupMode === "ask" && (
              <>
                <p className="mb-6 text-center text-sm text-[color:var(--color-text)]/80">Do you want to connect with <span className="font-semibold text-white tx1">{connectPopupTarget.display_name}</span>?</p>
                <div className="flex gap-3">
                  <button onClick={closeConnectPopup} className="flex-1 rounded-full border border-white/10 py-3 text-sm font-semibold text-mist transition hover:border-white/30 hover:text-white">Cancel</button>
                  <button onClick={confirmConnect} disabled={connectSending} className="flex-1 rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-50">
                    {connectSending ? "Sending…" : "Yes, Connect"}
                  </button>
                </div>
              </>
            )}
            {connectPopupMode === "pending" && (
              <>
                <div className="mb-6 flex flex-col items-center gap-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet/15 text-2xl">⏳</span>
                  <p className="text-center text-sm text-[color:var(--color-text)]/80">You already sent a request to <span className="font-semibold text-white tx1">{connectPopupTarget.display_name}</span>. Waiting for them to accept.</p>
                </div>
                <button onClick={closeConnectPopup} className="w-full rounded-full border border-white/10 py-3 text-sm font-semibold text-mist transition hover:border-white/30 hover:text-white">OK</button>
              </>
            )}
            {connectPopupMode === "declined" && (
              <>
                <div className="mb-6 flex flex-col items-center gap-2">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl">😔</span>
                  <p className="text-center text-sm text-[color:var(--color-text)]/80"><span className="font-semibold text-white tx1">{connectPopupTarget.display_name}</span> has declined your request.</p>
                </div>
                <button onClick={closeConnectPopup} className="w-full rounded-full border border-white/10 py-3 text-sm font-semibold text-mist transition hover:border-white/30 hover:text-white">OK</button>
              </>
            )}
          </div>
        </div>
      )}

      {callStatus !== "idle" && callPeer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0C12]">
          <div className="pointer-events-none absolute inset-0 bg-aurora" />
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Avatar name={callPeer.display_name} color={callPeer.avatar_color} size={120} avatarUrl={callPeer.avatar_url} />
            <p className="mt-5 flex items-center font-display text-xl font-bold text-white">
              {callPeer.display_name}{isVerified(callPeer.username) && <VerifiedBadge size={18} />}
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
                <button onClick={declineCall} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg" aria-label="Decline">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
                <button onClick={acceptCall} className="flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white shadow-lg" aria-label="Accept">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                </button>
              </>
            ) : (
              <>
                {callStatus === "connected" && (
                  <button onClick={toggleMic} className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg ${micOn ? "bg-white/10" : "bg-white text-ink-900"}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                )}
                <button onClick={() => endCall(true)} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg" aria-label="End call">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {statusViewerUserId && activeStatusItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex gap-1 px-3 pt-3">
            {activeStatusList.map((s, i) => (
              <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                <div className="h-full bg-white" style={{ width: i <= statusViewerIndex ? "100%" : "0%" }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar name={activeStatusProfile?.display_name ?? ""} color={activeStatusProfile?.avatar_color ?? "#7C5CFF"} avatarUrl={activeStatusProfile?.avatar_url} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center text-sm font-semibold text-white">
                <span className="truncate">{activeStatusProfile?.display_name}</span>
                {isVerified(activeStatusProfile?.username) && <VerifiedBadge />}
              </p>
              <p className="text-xs text-white/60">{formatLastSeen(activeStatusItem.created_at)}</p>
            </div>
            {activeStatusItem.user_id === myProfile.id && (
              <button onClick={() => deleteStatus(activeStatusItem.id)} className="text-xs font-medium text-white/70 hover:text-white">Delete</button>
            )}
            <button onClick={closeStatusViewer} className="px-2 text-xl leading-none text-white" aria-label="Close">✕</button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <button className="absolute left-0 top-0 z-10 h-full w-1/3" onClick={() => advanceStatus(-1)} aria-label="Previous status" />
            <button className="absolute right-0 top-0 z-10 h-full w-1/3" onClick={() => advanceStatus(1)} aria-label="Next status" />
            {activeStatusItem.media_url ? (
              <img src={activeStatusItem.media_url} alt="Status" className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-8" style={{ background: activeStatusItem.bg_color ?? "#7C5CFF" }}>
                <p className="break-words text-center text-2xl font-semibold text-white">{activeStatusItem.text_content}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showTextStatusComposer && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: textStatusColor }}>
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={() => { setShowTextStatusComposer(false); setTextStatusDraft(""); }} className="text-xl text-white" aria-label="Cancel">✕</button>
            <button onClick={postTextStatus} disabled={!textStatusDraft.trim()} className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Post</button>
          </div>
          <div className="flex flex-1 items-center justify-center px-8">
            <textarea autoFocus value={textStatusDraft} onChange={(e) => setTextStatusDraft(e.target.value.slice(0, 200))} placeholder="Type a status…" rows={4} className="w-full resize-none bg-transparent text-center text-2xl font-semibold text-white placeholder:text-white/60 outline-none" />
          </div>
          <div className="flex justify-center gap-3 pb-8">
            {STATUS_COLORS.map((c) => (
              <button key={c} onClick={() => setTextStatusColor(c)} className={`h-8 w-8 rounded-full transition ${textStatusColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-black/20" : ""}`} style={{ background: c }} aria-label={`Choose color ${c}`} />
            ))}
          </div>
        </div>
      )}

      <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full md:max-w-xs flex-col border-r border-black/5 dark:border-white/5 bg-ink-800/60`}>
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-2xl font-bold">Aira<span className="text-gradient">Think</span></span>
          <div className="relative flex items-center gap-2">
            {activeId && (
              <button onClick={() => setIsSearchOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white" aria-label="Search messages">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button onClick={() => setShowNotifications((v) => !v)} className="relative flex h-9 w-9 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-white/10 bg-ink-800 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                  <button onClick={() => setShowNotifications(false)} className="text-mist hover:text-white">✕</button>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-mist">No new notifications</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((req) => (
                      <div key={req.id} className="border-b border-white/5 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={req.from_profile?.display_name ?? "User"} color={req.from_profile?.avatar_color ?? "#7C5CFF"} avatarUrl={req.from_profile?.avatar_url} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white tx1">{req.from_profile?.display_name} wants to connect with you!</p>
                            <p className="mt-0.5 text-[10px] text-mist">@{req.from_profile?.username}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex gap-2">
                          <button onClick={() => acceptRequest(req)} className="flex-1 rounded-full bg-gradient-to-r from-violet to-violet-light py-1.5 text-xs font-semibold text-white">Accept</button>
                          <button onClick={() => declineRequest(req)} className="flex-1 rounded-full border border-white/10 py-1.5 text-xs font-semibold text-mist hover:text-white">Leave</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {mobileTab === "home" && (
            <div className="flex h-full flex-col overflow-y-auto pb-10">
              <div className="flex flex-col items-center px-8 pt-10 text-center">
                <div className="glass animate-floatSlow mb-6 flex h-20 w-20 items-center justify-center rounded-3xl">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="url(#homeGrad)" strokeWidth="1.6" strokeLinejoin="round" />
                    <defs><linearGradient id="homeGrad" x1="3" y1="3" x2="21" y2="21"><stop stopColor="#9C82FF" /><stop offset="1" stopColor="#22D3B8" /></linearGradient></defs>
                  </svg>
                </div>
                <h2 className="font-display text-2xl font-bold text-white">Welcome to <span className="text-gradient">AiraThink</span>!</h2>
                <p className="mt-2 text-sm text-mist">Let&apos;s connect. Real conversations, real time.</p>
                <button onClick={() => setMobileTab("search")} className="mt-6 rounded-full bg-gradient-to-r from-violet to-violet-light px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet/30">
                  Start a conversation
                </button>
                {conversations.length > 0 && (
                  <button onClick={() => setMobileTab("chats")} className="mt-3 text-xs font-medium text-mist transition hover:text-black dark:hover:text-white">
                    Or go to your chats →
                  </button>
                )}
              </div>

              {/* News feed */}
              <div className="mt-8 px-4">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h3 className="font-display text-sm font-bold text-white">News for you</h3>
                  {myEmail && myEmail.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase() && (
                    <button
                      type="button"
                      onClick={() => { setEditingArticleId(null); setPublishTitle(""); setPublishBody(""); setPublishImageUrl(""); setPublishCategory("India"); setPublishFeatured(true); setShowPublishModal(true); }}
                      className="rounded-full bg-gradient-to-r from-violet to-violet-dark px-3 py-1 text-[11px] font-semibold text-white"
                    >
                      + Write article
                    </button>
                  )}
                </div>

                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {["For you", "World", "India", "Business", "Education", "Awareness"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSelectedNewsCategory(label)}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        selectedNewsCategory === label
                          ? "bg-gradient-to-r from-violet to-violet-dark text-white"
                          : "border border-white/10 bg-white/5 text-mist hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {(() => {
                  const filteredNews =
                    selectedNewsCategory === "For you"
                      ? newsArticles
                      : newsArticles.filter(
                          (a) => a.category?.toLowerCase() === selectedNewsCategory.toLowerCase()
                        );

                  if (loadingNews) {
                    return <p className="px-1 py-6 text-center text-xs text-mist">Loading news…</p>;
                  }

                  if (filteredNews.length === 0) {
                    return (
                      <p className="px-1 py-6 text-center text-sm text-mist">
                        No {selectedNewsCategory === "For you" ? "news" : selectedNewsCategory} articles yet. Check back soon.
                      </p>
                    );
                  }

                  const featured = filteredNews.find((a) => a.is_featured) ?? filteredNews[0];
                  const rest = filteredNews.filter((a) => a.id !== featured.id);
                  return (
                        <>
                          {/* ============ UPDATED: Featured Article with image support ============ */}
                          <button
                            onClick={() => openArticle(featured)}
                            className="relative mb-3 block h-42 w-full overflow-hidden rounded-2xl border border-white/10 text-left"
                            style={{ height: 168 }}
                          >
                            {/* Background image or gradient */}
                            {featured.image_url ? (
                              <img 
                                src={featured.image_url} 
                                alt={featured.title}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0" style={{ background: featured.thumb_gradient }} />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/20 to-transparent" />
                            <div className="relative flex h-full flex-col justify-end p-4">
                              <span className="mb-2 self-start rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
                                Featured · {featured.category}
                              </span>
                              <h4 className="font-display text-base font-bold leading-snug text-white">{featured.title}</h4>
                              <p className="mt-1.5 flex items-center gap-1 text-xs text-white/75">
                                {featured.source}{isAiraThinkSource(featured.source) && <VerifiedBadge size={11} />} · {featured.read_time}
                                <span className="ml-1 inline-flex items-center gap-1 text-teal">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /></svg>
                                  {formatViewCount(seededViewCount(featured.id))}
                                </span>
                              </p>
                            </div>
                          </button>

                          {/* ============ UPDATED: Regular articles with image support ============ */}
                          <div className="flex flex-col">
                            {rest.map((article) => (
                              <button
                                key={article.id}
                                onClick={() => openArticle(article)}
                                className="flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-white/5"
                              >
                                {/* Thumbnail - now shows image if available */}
                                {article.image_url ? (
                                  <img 
                                    src={article.image_url} 
                                    alt={article.title}
                                    className="h-[70px] w-[70px] shrink-0 rounded-2xl object-cover"
                                  />
                                ) : (
                                  <span
                                    className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-2xl text-2xl"
                                    style={{ background: article.thumb_gradient }}
                                  >
                                    {article.emoji}
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-teal">{article.category}</p>
                                  <p className="text-[13.5px] font-semibold leading-snug text-white">{article.title}</p>
                                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-mist">
                                    {article.source}{isAiraThinkSource(article.source) && <VerifiedBadge size={10} />} · {article.read_time}
                                    <span className="ml-1 inline-flex items-center gap-1 text-teal">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" /></svg>
                                      {formatViewCount(seededViewCount(article.id))}
                                    </span>
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      );
                })()}
              </div>
            </div>
          )}

          {mobileTab === "status" && (
            <div className="px-2 pb-4">
              <input ref={statusFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleStatusFilePick} />
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="relative">
                  {myStatuses.length > 0 ? (
                    <button onClick={() => openStatusViewer(myProfile.id)}>
                      <StatusRing {...statusRingPropsFor(myProfile.id)}>
                        <Avatar name={myProfile.display_name} color={myProfile.avatar_color} avatarUrl={myProfile.avatar_url} size={64} />
                      </StatusRing>
                    </button>
                  ) : (
                    <Avatar name={myProfile.display_name} color={myProfile.avatar_color} avatarUrl={myProfile.avatar_url} size={64} />
                  )}
                  <button onClick={() => statusFileInputRef.current?.click()} disabled={uploadingStatus} className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-800 bg-violet text-white disabled:opacity-50" aria-label="Add photo status">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.4" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <button onClick={() => (myStatuses.length > 0 ? openStatusViewer(myProfile.id) : setShowTextStatusComposer(true))} className="flex-1 text-left">
                  <p className="text-base font-semibold text-white">My Status</p>
                  <p className="text-sm text-mist">{uploadingStatus ? "Uploading…" : myStatuses.length > 0 ? "Tap to view" : "Tap to add a status update"}</p>
                </button>
                <button onClick={() => setShowTextStatusComposer(true)} className="rounded-full px-3 py-1.5 text-xs font-medium text-violet-light transition hover:bg-black/5 dark:hover:bg-white/5">Aa</button>
              </div>
              {Object.keys(otherStatusesGrouped).length > 0 && (
                <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-mist/70">Recent updates</p>
              )}
              {Object.entries(otherStatusesGrouped).map(([userId, list]) => {
                const p = list[0].profile; const latest = list[list.length - 1]; const ring = statusRingPropsFor(userId);
                return (
                  <button key={userId} onClick={() => openStatusViewer(userId)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/5 dark:hover:bg-white/5">
                    <StatusRing {...ring}>
                      <Avatar name={p?.display_name ?? "Unknown"} color={p?.avatar_color ?? "#7C5CFF"} avatarUrl={p?.avatar_url} size={64} />
                    </StatusRing>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center truncate text-base font-semibold text-white">
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
                <p className="px-3 py-6 text-center text-sm text-mist">No conversations yet. Tap Search to start one.</p>
              )}
              {conversations.map((c) => {
                const name = c.is_group ? c.name ?? "Group" : c.otherProfile?.display_name ?? "Unknown";
                const color = c.otherProfile?.avatar_color ?? "#7C5CFF";
                const online = c.otherProfile ? onlineIds.has(c.otherProfile.id) : false;
                const ring = c.otherProfile ? statusRingPropsFor(c.otherProfile.id) : { hasStatus: false, viewed: true };
                return (
                  <button key={c.id} onClick={() => { setActiveId(c.id); setMobileTab("chats"); }} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:bg-black/10 dark:active:bg-white/10 ${activeId === c.id ? "bg-violet/15" : "md:hover:bg-black/5 md:dark:hover:bg-white/5"}`}>
                    <StatusRing {...ring}>
                      <Avatar name={name} color={color} online={online} avatarUrl={c.otherProfile?.avatar_url} size={56} />
                    </StatusRing>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center truncate text-lg font-semibold text-white">
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
              <input autoFocus value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Search by username…" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none" />
              <div className="mt-3">
                {searchResults.map((r) => (
                  <button key={r.id} onClick={() => openProfileView(r)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5">
                    <Avatar name={r.display_name} color={r.avatar_color} size={36} avatarUrl={r.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center font-semibold text-white">{r.display_name}{isVerified(r.username) && <VerifiedBadge />}</p>
                      <p className="text-xs text-mist">@{r.username}</p>
                    </div>
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
              <h2 className="mb-6 text-center font-display text-lg font-bold text-white">Edit Profile</h2>
              <div className="flex flex-col items-center">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
                <button onClick={() => fileInputRef.current?.click()} className="group relative" disabled={uploading}>
                  <Avatar name={myProfile.display_name} color={myProfile.avatar_color} size={96} avatarUrl={myProfile.avatar_url} />
                  <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-800 bg-violet text-white shadow-lg">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="13" r="3" stroke="white" strokeWidth="1.6" /></svg>
                  </span>
                </button>
                <p className="mt-2 text-xs text-mist">{uploading ? "Uploading…" : "Tap photo to change"}</p>
              </div>

              {/* Active Status Switch */}
              <div className="glass mt-6 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet/15 text-violet-light">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.55 1.55M7.15 16.85 5.6 18.4M18.4 18.4l-1.55-1.55M7.15 7.15 5.6 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">Active Status</p>
                      <p className="text-[11px] text-mist">{activeStatusOn ? "You're visible online" : "You're appearing offline"}</p>
                    </div>
                  </div>
                  <ActiveStatusSwitch on={activeStatusOn} onChange={toggleActiveStatus} />
                </div>
              </div>

              <div className="glass mt-4 divide-y divide-black/5 dark:divide-white/5 overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Full name</span>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="w-40 bg-transparent text-right text-sm text-white outline-none" />
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Email</span>
                  <span className="truncate text-sm text-white">{myEmail || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Username</span>
                  <span className="inline-flex items-center text-sm text-white">@{myProfile.username}{isVerified(myProfile.username) && <VerifiedBadge />}</span>
                </div>
                <button onClick={handleLogout} className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-black/5 dark:hover:bg-white/5">
                  <span className="text-xs font-medium text-mist">Account</span>
                  <span className="text-sm font-medium text-red-400">Log out</span>
                </button>
              </div>
              <div className="glass mt-4 rounded-2xl px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-mist">Bio</span>
                  <span className="text-[10px] text-mist/70">{bioDraft.length}/{MAX_BIO_LENGTH}</span>
                </div>
                <textarea value={bioDraft} onChange={(e) => setBioDraft(e.target.value.slice(0, MAX_BIO_LENGTH))} placeholder="Write something about yourself…" rows={3} className="mt-2 w-full resize-none bg-transparent text-sm text-white placeholder:text-mist/50 outline-none" />
              </div>
              <button
                onClick={() => { saveDisplayName(); saveBio(); }}
                disabled={(!nameDraft.trim() || nameDraft.trim() === myProfile.display_name) && bioDraft.trim() === (myProfile.bio ?? "")}
                className="mt-6 w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-40"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 border-t border-black/10 dark:border-white/10 bg-ink-900/95 backdrop-blur-md px-1 pb-[env(safe-area-inset-bottom)]">
          {(["home", "status", "chats", "search", "profile"] as MobileTab[]).map((tab) => {
            const isActive = mobileTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className="flex flex-col items-center justify-center gap-1 py-3 transition-transform active:scale-90"
                aria-label={tab}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-200 ${
                    isActive ? "bg-violet/20 text-violet-light scale-110" : "text-mist"
                  }`}
                >
                  <TabIcon tab={tab} active={isActive} />
                </span>
                <span
                  className={`text-[10px] font-semibold capitalize transition-colors ${
                    isActive ? "text-violet-light" : "text-mist/70"
                  }`}
                >
                  {tab}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className={`${activeId ? "flex" : "hidden md:flex"} relative min-w-0 flex-1 flex-col`}>
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-40" />

        {!active ? (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
            <div className="glass animate-floatSlow mb-6 flex h-20 w-20 items-center justify-center rounded-3xl">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="#9C82FF" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-white">Pick a conversation</h2>
            <p className="mt-1 max-w-xs text-sm text-mist">Or start a new one from Search — your messages sync in real time.</p>
          </div>
        ) : showContactInfo ? (
          <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
            <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full opacity-30"
              style={{ background: `radial-gradient(circle, ${otherDisplayProfile?.avatar_color ?? "#7C5CFF"}55 0%, transparent 70%)` }} />
            <header className="glass relative z-10 flex items-center gap-3 border-b border-white/5 px-4 py-4">
              <button onClick={() => setShowContactInfo(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-mist transition hover:bg-white/5 hover:text-white" aria-label="Back to chat">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <p className="text-sm font-semibold text-white/80 tx2">Contact info</p>
            </header>
            <div className="relative z-10 flex flex-col items-center px-6 pt-8 pb-6 text-center" style={{ animation: "ciSlideUp 0.35s ease-out forwards" }}>
              <div className="mb-4 rounded-full p-[3px]" style={{ background: "linear-gradient(135deg, #7C5CFF, #22D3B8)" }}>
                <div className="rounded-full border-[3px] border-[#0A0C12]">
                  <Avatar
                    name={active.is_group ? active.name ?? "Group" : otherDisplayProfile?.display_name ?? "Unknown"}
                    color={otherDisplayProfile?.avatar_color ?? "#7C5CFF"}
                    size={100}
                    avatarUrl={otherDisplayProfile?.avatar_url}
                  />
                </div>
              </div>
              <h2 className="flex items-center font-display text-xl font-bold text-white tx1">
                {active.is_group ? active.name ?? "Group" : otherDisplayProfile?.display_name ?? "Unknown"}
                {isVerified(otherDisplayProfile?.username) && <VerifiedBadge size={18} />}
              </h2>
              {!active.is_group && <p className="mt-1 text-sm text-white/45 tx2">@{otherDisplayProfile?.username}</p>}
              {!active.is_group && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${otherIsOnline ? "bg-teal" : "bg-white/25"}`} />
                  <span className="text-xs text-white/60 tx2">
                    {otherIsOnline ? "Active now" : otherDisplayProfile?.last_seen ? `Last seen ${formatLastSeen(otherDisplayProfile.last_seen)}` : "Offline"}
                  </span>
                </div>
              )}
              {otherDisplayProfile?.bio && (
                <p className="mt-4 max-w-xs whitespace-pre-wrap text-sm leading-relaxed text-white/60 tx2">{otherDisplayProfile.bio}</p>
              )}
            </div>
            {!active.is_group && (
              <div className="relative z-10 flex gap-3 px-5 pb-5">
                <button onClick={() => setShowContactInfo(false)} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 py-3.5 text-white/75 tx2 transition hover:bg-white/8">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                  <span className="text-[11px] font-semibold tracking-wide">Message</span>
                </button>
                <button onClick={() => { setShowContactInfo(false); startCall(); }} disabled={callStatus !== "idle"} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 py-3.5 text-white/75 tx2 transition hover:bg-white/8 disabled:opacity-40">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                  <span className="text-[11px] font-semibold tracking-wide">Call</span>
                </button>
                <button onClick={() => setContactMuted((v) => !v)} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 py-3.5 text-white/75 tx2 transition hover:bg-white/8">
                  {contactMuted ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0M2 2l20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                  <span className="text-[11px] font-semibold tracking-wide">{contactMuted ? "Unmute" : "Mute"}</span>
                </button>
              </div>
            )}
            <div className="relative z-10 mx-5 mb-4 h-px bg-white/6" />
            <div className="relative z-10 flex flex-col gap-2 px-5 pb-8">
              <button onClick={() => setContactBlocked((v) => !v)} className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-semibold transition" style={{ background: contactBlocked ? "rgba(248,113,113,0.10)" : "rgba(255,255,255,0.03)", borderColor: contactBlocked ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.07)", color: "#F87171" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M5.5 5.5l13 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                {contactBlocked ? "Unblock User" : "Block User"}
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/7 bg-white/3 py-3.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/8">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                Delete Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="glass relative z-10 flex items-center gap-3 border-b border-black/5 dark:border-white/5 px-4 py-4 md:px-6">
              <button onClick={() => setActiveId(null)} className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white md:hidden" aria-label="Back to conversations">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button onClick={() => setShowContactInfo(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left transition hover:bg-black/5 dark:hover:bg-white/5">
                <Avatar name={active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"} color={active.otherProfile?.avatar_color ?? "#7C5CFF"} online={otherIsOnline} avatarUrl={active.otherProfile?.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center text-sm font-semibold text-white">
                    <span className="truncate">{active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"}</span>
                    {isVerified(active.otherProfile?.username) && <VerifiedBadge />}
                  </p>
                  {!active.is_group && (
                    <p className="truncate text-xs text-mist">
                      {peerTyping ? <span className="text-teal animate-pulse">typing…</span> : otherIsOnline ? <span className="text-teal">Active now</span> : otherProfileFresh?.last_seen ? `Last seen ${formatLastSeen(otherProfileFresh.last_seen)}` : `@${active.otherProfile?.username}`}
                    </p>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsSearchOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-mist transition hover:bg-white/5 hover:text-white" aria-label="Search messages">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                {!active.is_group && (
                  <button onClick={startCall} disabled={callStatus !== "idle"} className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet to-violet-light text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-40" aria-label="Voice call">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                  </button>
                )}
              </div>
            </header>

            <div ref={scrollRef} onScroll={handleMessagesScroll} className="relative z-10 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-6 py-6">
              {loadingMore && <p className="pb-2 text-center text-xs text-mist">Loading older messages…</p>}
              {messages.map((m, idx) => {
                const mine = m.sender_id === myProfile.id;
                const isImage = m.message_type === "image" && !!m.media_url;
                const isVoice = m.message_type === "voice" && !!m.media_url;
                const quoted = messageById(m.reply_to_id);
                const isSwiping = swipeState?.id === m.id;
                const translateX = isSwiping ? swipeState!.dx : 0;
                const prevMsg = messages[idx - 1];
                const showDayDivider = !prevMsg || formatDayLabel(prevMsg.created_at) !== formatDayLabel(m.created_at);
                const grouped = !!prevMsg && !showDayDivider && prevMsg.sender_id === m.sender_id
                  && (new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < GROUPED_GAP_MS;
                const isPinned = pinnedMessages.has(m.id);
                const isDeleted = m.is_deleted || false;
                const canEdit = mine && !isDeleted && Date.now() - new Date(m.created_at).getTime() < EDIT_TIMEOUT_MS;

                return (
                  <Fragment key={m.id}>
                    {showDayDivider && (
                      <div className="my-4 flex items-center justify-center">
                        <span className="text-[13px] font-medium text-mist">
                          {formatDayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`relative flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2.5"}`} onTouchStart={(e) => onBubbleTouchStart(e, m)} onTouchMove={(e) => onBubbleTouchMove(e, m)} onTouchEnd={() => onBubbleTouchEnd(m)}>
                      {isSwiping && translateX > 12 && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-violet-light" style={{ opacity: Math.min(1, translateX / SWIPE_REPLY_THRESHOLD) }}>↩</span>
                      )}
                      <div style={{ transform: `translateX(${translateX}px)`, transition: isSwiping ? "none" : "transform 0.15s ease-out" }} className="max-w-[80%] md:max-w-md" onDoubleClick={() => toggleReaction(m.id, "❤️")} onContextMenu={(e) => { e.preventDefault(); setReactionPickerFor(reactionPickerFor === m.id ? null : m.id); }}>
                        {reactionPickerFor === m.id && (
                          <div className={`mb-1 flex gap-1 rounded-full bg-ink-800 px-2 py-1 shadow-lg ${mine ? "justify-end" : "justify-start"}`}>
                            {QUICK_EMOJIS.map((emo) => (
                              <button key={emo} onClick={() => toggleReaction(m.id, emo)} className="text-lg leading-none hover:scale-110 transition">{emo}</button>
                            ))}
                          </div>
                        )}
                        <div className={`relative ${isDeleted ? 'opacity-50' : ''}`}>
                          {isPinned && (
                            <div className="absolute -top-3 -right-1 text-xs text-violet-light">📌</div>
                          )}
                          <div className={`text-[16px] leading-snug ${isImage ? "overflow-hidden rounded-2xl p-1" : "rounded-2xl px-4 py-2.5"} ${mine ? `${isImage ? "" : "bg-gradient-to-br from-violet to-violet-dark"} rounded-br-sm text-white shadow-md shadow-violet/20` : `${isImage ? "" : "glass bubble-received"} rounded-bl-sm text-[color:var(--color-text)]`}`}>
                            {quoted && (
                              <div className={`mb-1.5 rounded-lg border-l-2 border-violet-light bg-black/25 px-2 py-1 text-xs ${isImage ? "mx-2 mt-2" : ""}`}>
                                <p className="font-medium text-violet-light">{quoted.sender_id === myProfile.id ? "You" : active.otherProfile?.display_name ?? "Message"}</p>
                                <p className="truncate text-white/70">{previewForQuote(quoted)}</p>
                              </div>
                            )}
                            {isDeleted ? (
                              <p className="text-sm italic text-mist">This message was deleted</p>
                            ) : isImage ? (
                              <img src={m.media_url!} alt="Shared photo" className="max-h-72 w-full cursor-pointer rounded-xl object-cover" onClick={() => window.open(m.media_url!, "_blank")} />
                            ) : isVoice ? (
                              <VoiceMessage 
                                url={m.media_url!} 
                                duration={m.media_duration ?? 0} 
                                mine={mine} 
                                isDeleted={isDeleted}
                              />
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-white">
                                {m.content}
                                {m.edited_at && <span className="ml-1 text-[10px] text-mist">(edited)</span>}
                                {m.is_forwarded && <span className="ml-1 text-[10px] text-mist">↪ forwarded</span>}
                              </p>
                            )}
                            {isImage && !isDeleted && (
                              <p className="mt-1 flex items-center justify-end gap-1 px-2 pb-1 text-[10px] text-white/60">
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {mine && <Ticks read={!!m.read_at} />}
                              </p>
                            )}
                          </div>
                          {!isImage && !isDeleted && (
                            <p className={`mt-1 flex items-center gap-1 px-1 text-[12px] text-mist ${mine ? "justify-end" : "justify-start"}`}>
                              <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              {mine && <Ticks read={!!m.read_at} className={m.read_at ? "text-sky-500" : "text-mist"} />}
                            </p>
                          )}
                          <ReactionPills msgReactions={reactionsByMsg[m.id] ?? []} myId={myProfile.id} onToggle={(emoji) => toggleReaction(m.id, emoji)} />
                          
                          {/* Message Actions */}
                          {!isDeleted && (
                            <div className={`mt-1 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                              <button 
                                onClick={() => togglePinMessage(m.id)}
                                className={`text-[10px] transition ${isPinned ? 'text-violet-light' : 'text-mist hover:text-white'}`}
                              >
                                {isPinned ? '📌' : '📍'}
                              </button>
                              <button 
                                onClick={() => { setForwardingMessage(m); setShowForwardModal(true); }}
                                className="text-[10px] text-mist hover:text-white transition"
                              >
                                ➡️
                              </button>
                              {canEdit && (
                                <button 
                                  onClick={() => startEditMessage(m)}
                                  className="text-[10px] text-mist hover:text-white transition"
                                >
                                  ✏️
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  if (mine) {
                                    const action = confirm("Delete for everyone or just for you?");
                                    if (action !== null) {
                                      deleteMessage(m.id, action);
                                    }
                                  } else {
                                    deleteMessage(m.id, false);
                                  }
                                }}
                                className="text-[10px] text-red-400 hover:text-red-500 transition"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              {peerTyping && !active.is_group && (
                <div className="mt-2.5">
                  <TypingBubble />
                </div>
              )}
              {messages.length === 0 && !peerTyping && <p className="pt-10 text-center text-sm text-mist">No messages yet — say hello 👋</p>}
            </div>

            {replyingTo && (
              <div className="relative z-10 flex items-center justify-between border-t border-black/5 dark:border-white/5 bg-ink-800/60 px-6 py-2">
                <div className="min-w-0 flex-1 border-l-2 border-violet-light pl-2">
                  <p className="text-xs font-medium text-violet-light">Replying to {replyingTo.sender_id === myProfile.id ? "yourself" : active.otherProfile?.display_name ?? "message"}</p>
                  <p className="truncate text-xs text-mist">{previewForQuote(replyingTo)}</p>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="ml-3 shrink-0 text-mist hover:text-black dark:hover:text-white" aria-label="Cancel reply">✕</button>
              </div>
            )}

            <form onSubmit={sendMessage} className="relative z-10 border-t border-white/5 bg-gradient-to-t from-ink-900 via-ink-900/95 to-transparent px-4 py-3">
              <input ref={mediaInputRef} type="file" accept="image/*" className="hidden" onChange={handleMediaFilePick} />
              <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-1.5 py-1.5 backdrop-blur-xl shadow-lg shadow-black/20">
                <button type="button" onClick={() => mediaInputRef.current?.click()} disabled={uploadingMedia} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-mist transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 disabled:opacity-30" aria-label="Send image">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.6"/>
                    <circle cx="8" cy="10" r="2" fill="currentColor"/>
                    <path d="M22 16l-5-5-5 5M17 11l-3 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {recording ? (
                  <>
                    <div className="flex flex-1 items-center gap-3 px-3">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className={`absolute inset-0 animate-ping rounded-full ${recordingPaused ? 'bg-yellow-400' : 'bg-red-400'} opacity-75`} />
                        <span className={`relative h-3 w-3 rounded-full ${recordingPaused ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      </span>
                      <span className={`flex-1 text-sm font-medium tracking-wide ${recordingPaused ? 'text-yellow-400' : 'text-red-400'}`}>
                        {recordingPaused ? 'Paused' : 'Recording'} {formatDuration(recordingSeconds)}
                      </span>
                      {recordingPaused ? (
                        <button type="button" onClick={resumeRecording} className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition">
                          Resume
                        </button>
                      ) : (
                        <button type="button" onClick={pauseRecording} className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition">
                          Pause
                        </button>
                      )}
                      <button type="button" onClick={cancelRecording} className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-mist hover:bg-white/10 hover:text-white transition">
                        Cancel
                      </button>
                    </div>
                    <button type="button" onClick={stopAndSendRecording} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-light text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 hover:scale-105 active:scale-95" aria-label="Send voice note">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M22 2L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      value={input}
                      onChange={handleInputChange}
                      onFocus={() => { setTimeout(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, 300); }}
                      placeholder={uploadingMedia ? "Sending…" : replyingTo ? "Reply…" : "Message"}
                      disabled={uploadingMedia}
                      className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[15px] text-white placeholder:text-white/25 msg-input-tx outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none disabled:opacity-40"
                    />
                    {input.trim() ? (
                      <button type="submit" disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-light text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100" aria-label="Send message">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M22 2L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ) : (
                      <button type="button" onClick={startRecording} disabled={uploadingMedia} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-mist transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 disabled:opacity-30" aria-label="Record voice note">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          </>
        )}
      </section>

      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-900 p-5 sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">{editingArticleId ? "Edit article" : "Write article"}</h3>
              <button
                type="button"
                onClick={() => { setShowPublishModal(false); setPublishError(""); setEditingArticleId(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-mist hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-mist">Title</label>
                <input
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  placeholder="Article title"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-mist">Category</label>
                <select
                  value={publishCategory}
                  onChange={(e) => setPublishCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-violet"
                >
                  {["World", "India", "Business", "Education", "Awareness"].map((c) => (
                    <option key={c} value={c} className="bg-ink-900">{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-mist">Body</label>
                <textarea
                  value={publishBody}
                  onChange={(e) => setPublishBody(e.target.value)}
                  placeholder="Article content — blank line = new paragraph"
                  rows={8}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-mist">Image</label>
                {publishImageUrl ? (
                  <div className="relative mb-2 h-36 w-full overflow-hidden rounded-xl">
                    <img src={publishImageUrl} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPublishImageUrl("")}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="mb-2 flex h-24 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 text-sm text-mist hover:border-violet hover:text-white">
                    {uploadingPublishImage ? (
                      "Uploading…"
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Upload photo from device
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePublishImagePick}
                      disabled={uploadingPublishImage}
                    />
                  </label>
                )}
                <input
                  value={publishImageUrl}
                  onChange={(e) => setPublishImageUrl(e.target.value)}
                  placeholder="or paste an image URL…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-mist">
                <input
                  type="checkbox"
                  checked={publishFeatured}
                  onChange={(e) => setPublishFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5"
                />
                Show in featured section
              </label>

              {publishError && (
                <p className="text-xs font-medium text-red-400">{publishError}</p>
              )}

              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || uploadingPublishImage}
                className="mt-1 w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-50"
              >
                {publishing ? (editingArticleId ? "Saving…" : "Publishing…") : (editingArticleId ? "Save changes" : "Publish")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-900 p-5">
            <h3 className="font-display text-base font-bold text-white">Article delete karein?</h3>
            <p className="mt-2 text-sm text-mist">Ye action undo nahi ho sakta.</p>
            {publishError && (
              <p className="mt-2 text-xs font-medium text-red-400">{publishError}</p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setConfirmDeleteId(null); setPublishError(""); }}
                className="flex-1 rounded-full bg-white/5 py-2.5 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteArticle(confirmDeleteId)}
                disabled={deletingArticle}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deletingArticle ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
