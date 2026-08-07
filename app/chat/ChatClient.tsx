"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";

// ---------- types ----------
type Profile = {
  id: string; username: string; display_name: string; avatar_color: string;
  status: string; last_seen?: string; avatar_url?: string | null; bio?: string | null;
};
type MessageType = "text" | "image" | "voice";
type Message = {
  id: string; conversation_id: string; sender_id: string; content: string;
  created_at: string; read_at?: string | null; message_type?: MessageType;
  media_url?: string | null; media_duration?: number | null; reply_to_id?: string | null;
};
type Reaction = { id: string; message_id: string; user_id: string; emoji: string };
type Status = {
  id: string; user_id: string; media_url: string | null; text_content: string | null;
  bg_color: string | null; created_at: string; expires_at: string; profile?: Profile;
};
type ConversationRow = {
  id: string; is_group: boolean; name: string | null; otherProfile: Profile | null;
  lastMessage: string; lastAt: string; unreadCount: number;
};
type ConnectionRequest = {
  id: string; from_user_id: string; to_user_id: string; status: string;
  created_at: string; from_profile?: Profile;
};
type MobileTab = "home" | "status" | "chats" | "search" | "profile";
type CallStatus = "idle" | "outgoing" | "incoming" | "connected";

// ---------- constants ----------
const ICE_SERVERS: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
const PAGE_SIZE = 30;
const CHAT_MEDIA_BUCKET = "chat-media";
const STATUS_MEDIA_BUCKET = "status-media";
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
const HOME_FEATURES = [
  { icon: "🔒", title: "End-to-end encryption", desc: "Your messages stay private, always." },
  { icon: "⚡", title: "Realtime chat", desc: "Messages arrive instantly, no delay." },
  { icon: "⏳", title: "24 hours disappearing", desc: "Status updates vanish after a day." },
  { icon: "🆓", title: "Free to use", desc: "No subscriptions, no hidden costs." },
  { icon: "📶", title: "Works on all networks", desc: "Smooth on 3G, 4G, 5G and beyond." },
];

// ---------- helpers ----------
const sendPushNotification = (opts: { userId?: string | null; title: string; body: string; url?: string }) => {
  if (!opts.userId) return;
  fetch("/api/send-push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts) }).catch(() => {});
};
const initials = (name: string) => name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase();
const formatLastSeen = (iso?: string) => {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
};
const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
const formatDayLabel = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
};
const isVerified = (u?: string) => ["sudhakarin","tanushree2251"].includes(u?.toLowerCase()||"");

// ---------- small UI components ----------
const VerifiedBadge = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="ml-1 inline-block shrink-0 align-middle"><path d="M12 1.8l2.2 1.6 2.8-.4 1.1 2.6 2.6 1.1-.4 2.8L22.2 12l-1.9 2.3.4 2.8-2.6 1.1-1.1 2.6-2.8-.4L12 22.2l-2.2-1.8-2.8.4-1.1-2.6-2.6-1.1.4-2.8L1.8 12l1.9-2.3-.4-2.8 2.6-1.1 1.1-2.6 2.8.4L12 1.8Z" fill="white"/><path d="M7.6 12.1L10.4 14.9L16.6 8.7" fill="none" stroke="#111827" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const Avatar = ({ name, color, size = 40, online, avatarUrl }: { name: string; color: string; size?: number; online?: boolean; avatarUrl?: string|null }) => (
  <div className="relative shrink-0" style={{ width:size, height:size }}>
    {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover"/> :
    <div className="flex h-full w-full items-center justify-center rounded-full font-display text-xs font-bold text-white" style={{ background:color }}>{initials(name)}</div>}
    {online && <span className="absolute bottom-0 right-0 rounded-full border-2 border-ink-900 bg-teal" style={{ width:size*0.3, height:size*0.3 }}/>}
  </div>
);
const StatusRing = ({ hasStatus, viewed, children }: { hasStatus: boolean; viewed: boolean; children: React.ReactNode }) => hasStatus ? (
  <div className="rounded-full p-[2px]" style={{ background: viewed ? "#4B5563" : "linear-gradient(45deg, #7C5CFF, #22D3B8)" }}><div className="rounded-full bg-ink-900 p-[2px]">{children}</div></div>
) : <>{children}</>;
const Ticks = ({ read }: { read: boolean }) => read ? (
  <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="inline-block align-middle text-white"><path d="M1 5l3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5l3 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
) : (
  <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="inline-block align-middle text-white/40"><path d="M1 5l3 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const TabIcon = ({ tab }: { tab: MobileTab }) => {
  if (tab === "home") return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 11l8-7 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (tab === "status") return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>;
  if (tab === "chats") return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>;
  if (tab === "search") return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
};
const VoiceMessage = ({ url, duration, mine }: { url: string; duration: number; mine: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveDur, setLiveDur] = useState(duration);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => { if (a.duration && isFinite(a.duration)) setProgress(a.currentTime / a.duration) };
    const onLoad = () => { if (a.duration && isFinite(a.duration)) setLiveDur(a.duration) };
    const onEnd = () => { setPlaying(false); setProgress(0) };
    a.addEventListener("timeupdate", onTime); a.addEventListener("loadedmetadata", onLoad); a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("loadedmetadata", onLoad); a.removeEventListener("ended", onEnd) };
  }, []);
  const toggle = () => audioRef.current && (playing ? audioRef.current.pause() : audioRef.current.play()) || setPlaying(!playing);
  return (
    <div className="flex min-w-[190px] items-center gap-2.5 py-0.5">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden"/>
      <button onClick={toggle} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${mine ? "bg-white/20 hover:bg-white/30" : "bg-violet/20 hover:bg-violet/30"}`} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg> :
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z"/></svg>}
      </button>
      <div className="flex-1"><div className={`h-1 w-full overflow-hidden rounded-full ${mine ? "bg-white/25" : "bg-black/15 dark:bg-white/15"}`}><div className={`h-full rounded-full ${mine ? "bg-white" : "bg-violet-light"}`} style={{ width:`${Math.min(100, progress*100)}%` }}/></div></div>
      <span className={`shrink-0 text-[10px] tabular-nums ${mine ? "text-white/70" : "text-mist"}`}>{formatDuration(liveDur)}</span>
    </div>
  );
};
const TypingBubble = () => (
  <div className="flex justify-start items-end gap-2">
    <div className="glass flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm">
      {[0,1,2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-mist/60" style={{ animation: `typingDot 1.4s ease-in-out infinite`, animationDelay: `${i*0.2}s` }}/>)}
    </div>
  </div>
);
const ReactionPills = ({ msgReactions, myId, onToggle }: { msgReactions: Reaction[]; myId: string; onToggle: (emoji: string) => void }) => {
  if (!msgReactions?.length) return null;
  const grouped = msgReactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++; if (r.user_id === myId) acc[r.emoji].mine = true;
    return acc;
  }, {} as Record<string, { count: number; mine: boolean }>);
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {Object.entries(grouped).map(([emoji, info]) => (
        <button key={emoji} onClick={() => onToggle(emoji)} className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition ${info.mine ? "bg-violet/30 ring-1 ring-violet-light" : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"}`}>
          <span>{emoji}</span>{info.count > 1 && <span className="text-[10px] text-[color:var(--color-text)]/70">{info.count}</span>}
        </button>
      ))}
    </div>
  );
};

// ---------- custom hooks ----------
function useVisualViewportHeight() {
  useEffect(() => {
    const setH = () => document.documentElement.style.setProperty("--app-height", `${window.visualViewport?.height ?? window.innerHeight}px`);
    setH(); window.visualViewport?.addEventListener("resize", setH); window.visualViewport?.addEventListener("scroll", setH); window.addEventListener("resize", setH);
    return () => { window.visualViewport?.removeEventListener("resize", setH); window.visualViewport?.removeEventListener("scroll", setH); window.removeEventListener("resize", setH) };
  }, []);
}

// ---------- main component ----------
export default function ChatClient({ profile: initialProfile }: { profile: Profile }) {
  const supabase = createClient(); const router = useRouter();
  useVisualViewportHeight();

  const [myProfile, setMyProfile] = useState(initialProfile);
  const [myEmail, setMyEmail] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPrependingRef = useRef(false);

  // conversations
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const loadConversations = useCallback(async () => {
    const { data: rows } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", myProfile.id);
    const ids = (rows??[]).map(r => r.conversation_id);
    if (!ids.length) { setConversations([]); setLoadingConvos(false); return; }
    const [{ data: convos }, { data: others }, { data: lasts }, { data: unreads }] = await Promise.all([
      supabase.from("conversations").select("id,is_group,name").in("id",ids),
      supabase.from("conversation_participants").select("conversation_id,user_id,profiles(*)").in("conversation_id",ids).neq("user_id",myProfile.id),
      supabase.from("messages").select("conversation_id,content,message_type,created_at").in("conversation_id",ids).order("created_at",{ascending:false}),
      supabase.from("messages").select("id,conversation_id").in("conversation_id",ids).neq("sender_id",myProfile.id).is("read_at",null)
    ]);
    const unreadCounts: Record<string,number> = {};
    (unreads??[]).forEach((m:any) => { unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id]||0)+1 });
    const previewFor = (m:any) => {
      if (!m) return "Say hello 👋";
      if (m.message_type==="image") return "📷 Photo";
      if (m.message_type==="voice") return "🎤 Voice message";
      return m.content;
    };
    const list = (convos??[]).map(c => {
      const other = (others??[]).find(p => p.conversation_id===c.id);
      const last = (lasts??[]).find(m => m.conversation_id===c.id);
      return { id:c.id, is_group:c.is_group, name:c.name, otherProfile:other?.profiles??null, lastMessage:previewFor(last), lastAt:last?.created_at??"", unreadCount:unreadCounts[c.id]??0 };
    });
    list.sort((a,b) => a.lastAt < b.lastAt ? 1 : -1);
    setConversations(list as any);
    setLoadingConvos(false);
  }, [myProfile.id, supabase]);
  useEffect(() => { loadConversations() }, [loadConversations]);
  useEffect(() => { const i = setInterval(loadConversations, 4000); return () => clearInterval(i) }, [loadConversations]);

  // notifications
  const [notifications, setNotifications] = useState<ConnectionRequest[]>([]);
  const loadNotifications = useCallback(async () => {
    const { data } = await supabase.from("connection_requests").select("*, from_profile:profiles!connection_requests_from_user_id_fkey(*)").eq("to_user_id",myProfile.id).eq("status","pending").order("created_at",{ascending:false});
    setNotifications((data??[]) as any);
  }, [myProfile.id, supabase]);
  useEffect(() => { loadNotifications(); const i = setInterval(loadNotifications, 4000); return () => clearInterval(i) }, [loadNotifications]);
  useEffect(() => { const ch = supabase.channel("connection-requests-realtime").on("postgres_changes",{event:"*",schema:"public",table:"connection_requests",filter:`to_user_id=eq.${myProfile.id}`},loadNotifications).subscribe(); return () => { supabase.removeChannel(ch) } }, [myProfile.id, supabase, loadNotifications]);
  useEffect(() => { const ch = supabase.channel("my-new-conversation-participant").on("postgres_changes",{event:"INSERT",schema:"public",table:"conversation_participants",filter:`user_id=eq.${myProfile.id}`},loadConversations).subscribe(); return () => { supabase.removeChannel(ch) } }, [myProfile.id, supabase, loadConversations]);
  async function acceptRequest(req: ConnectionRequest) {
    await supabase.from("connection_requests").update({status:"accepted"}).eq("id",req.id);
    const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id",myProfile.id);
    const myIds = (mine??[]).map(r => r.conversation_id);
    let convoId: string | null = null;
    if (myIds.length) {
      const { data: shared } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id",req.from_user_id).in("conversation_id",myIds);
      if (shared?.length) convoId = shared[0].conversation_id;
    }
    if (!convoId) {
      const { data: convo } = await supabase.from("conversations").insert({is_group:false,created_by:myProfile.id}).select().single();
      if (!convo) return;
      convoId = convo.id;
      await supabase.from("conversation_participants").insert([{conversation_id:convoId,user_id:myProfile.id},{conversation_id:convoId,user_id:req.from_user_id}]);
    }
    loadConversations(); setActiveId(convoId); setMobileTab("chats"); loadNotifications();
  }
  async function declineRequest(req: ConnectionRequest) {
    await supabase.from("connection_requests").update({status:"declined"}).eq("id",req.id);
    loadNotifications();
  }

  // messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, Reaction[]>>({});
  const lastMsgIdRef = useRef<string | null>(null);
  const lastMsgCreatedRef = useRef<string | null>(null);
  const activeChannelRef = useRef<any>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const lastTypingSentRef = useRef(0);
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setMessages([]); setHasMore(true); setReplyingTo(null); setReactionsByMsg({}); setPeerTyping(false);
    lastMsgCreatedRef.current = null; lastMsgIdRef.current = null;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id",activeId).order("created_at",{ascending:false}).limit(PAGE_SIZE);
      if (cancelled) return;
      const ordered = (data??[]).slice().reverse();
      setMessages(ordered); setHasMore((data??[]).length === PAGE_SIZE);
      if (ordered.length) { lastMsgCreatedRef.current = ordered[ordered.length-1].created_at; lastMsgIdRef.current = ordered[ordered.length-1].id; }
      loadReactionsFor(ordered.map(m => m.id));
    })();
    const ch = supabase.channel(`messages:${activeId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${activeId}`}, payload => {
        setPeerTyping(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        const incoming = payload.new as Message;
        lastMsgCreatedRef.current = incoming.created_at; lastMsgIdRef.current = incoming.id;
        setMessages(prev => {
          if (prev.some(m => m.id===incoming.id)) return prev;
          const clean = prev.filter(m => !(m.id.startsWith("temp-") && m.sender_id===incoming.sender_id && (m.content===incoming.content || (m.media_url && m.media_url===incoming.media_url))));
          return [...clean, incoming];
        });
        loadConversations();
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conversation_id=eq.${activeId}`}, payload => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id===updated.id ? updated : m));
      })
      .on("broadcast",{event:"typing"}, ({ payload }: any) => {
        if (!payload || payload.userId===myProfile.id) return;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (payload.typing===false) { setPeerTyping(false); return; }
        setPeerTyping(true); typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), TYPING_IDLE_MS);
      })
      .subscribe();
    activeChannelRef.current = ch;
    const rch = supabase.channel(`reactions:${activeId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"message_reactions"}, () => {
        setMessages(current => { loadReactionsFor(current.map(m => m.id)); return current; });
      }).subscribe();
    return () => { cancelled=true; supabase.removeChannel(ch); supabase.removeChannel(rch); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); activeChannelRef.current=null; };
  }, [activeId, supabase, loadConversations]);
  // polling fallback
  useEffect(() => {
    if (!activeId) return;
    const poll = async () => {
      const since = lastMsgCreatedRef.current; if (!since) return;
      const { data } = await supabase.from("messages").select("*").eq("conversation_id",activeId).gt("created_at",since).order("created_at",{ascending:true});
      if (!data?.length) return;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = data.filter((m:Message) => !existingIds.has(m.id));
        if (!newMsgs.length) return prev;
        const clean = prev.filter(m => m.id.startsWith("temp-") ? !newMsgs.some(nm => nm.sender_id===m.sender_id && (nm.content===m.content || (nm.media_url && nm.media_url===m.media_url))) : true);
        return [...clean, ...newMsgs];
      });
      const latest = data[data.length-1]; lastMsgCreatedRef.current = latest.created_at; lastMsgIdRef.current = latest.id;
    };
    const interval = setInterval(poll, POLL_INTERVAL_MS); return () => clearInterval(interval);
  }, [activeId, supabase]);

  async function loadReactionsFor(messageIds: string[]) {
    if (!messageIds.length) return;
    const { data } = await supabase.from("message_reactions").select("*").in("message_id",messageIds);
    const grouped: Record<string, Reaction[]> = {};
    (data??[]).forEach((r:Reaction) => { grouped[r.message_id] = [...(grouped[r.message_id]??[]), r] });
    setReactionsByMsg(grouped);
  }
  async function toggleReaction(messageId: string, emoji: string) {
    const existing = reactionsByMsg[messageId]?.find(r => r.user_id===myProfile.id && r.emoji===emoji);
    if (existing) await supabase.from("message_reactions").delete().eq("message_id",messageId).eq("user_id",myProfile.id).eq("emoji",emoji);
    else {
      await supabase.from("message_reactions").insert({message_id:messageId, user_id:myProfile.id, emoji});
      const target = messages.find(m => m.id===messageId);
      if (target && target.sender_id!==myProfile.id) sendPushNotification({userId:target.sender_id, title:myProfile.display_name, body:`${emoji} reacted to your message`, url:"/"});
    }
    loadReactionsFor(messages.map(m => m.id));
  }
  useEffect(() => {
    if (isPrependingRef.current) { isPrependingRef.current = false; return; }
    const el = scrollRef.current; if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) el.scrollTo({top:el.scrollHeight, behavior:"smooth"});
  }, [messages]);
  useEffect(() => {
    if (!peerTyping) return;
    const el = scrollRef.current; if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) setTimeout(() => el.scrollTo({top:el.scrollHeight, behavior:"smooth"}), 50);
  }, [peerTyping]);
  async function loadMoreMessages() {
    if (!activeId || loadingMore || !hasMore || !messages.length) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const { data } = await supabase.from("messages").select("*").eq("conversation_id",activeId).lt("created_at",oldest.created_at).order("created_at",{ascending:false}).limit(PAGE_SIZE);
    const older = (data??[]).slice().reverse();
    if (older.length < PAGE_SIZE) setHasMore(false);
    if (older.length) {
      const container = scrollRef.current; const prevH = container?.scrollHeight ?? 0;
      isPrependingRef.current = true;
      setMessages(prev => [...older, ...prev]); loadReactionsFor(older.map(m => m.id));
      requestAnimationFrame(() => { if (container) container.scrollTop = container.scrollHeight - prevH });
    }
    setLoadingMore(false);
  }
  const handleMessagesScroll = () => { if (scrollRef.current && scrollRef.current.scrollTop < 60) loadMoreMessages() };

  // typing broadcast
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setInput(val);
    const ch = activeChannelRef.current; if (!ch) return;
    if (!val.trim()) { ch.send({type:"broadcast",event:"typing",payload:{userId:myProfile.id,typing:false}}); lastTypingSentRef.current=0; return; }
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) { lastTypingSentRef.current = now; ch.send({type:"broadcast",event:"typing",payload:{userId:myProfile.id,typing:true}}); }
  };

  // recording
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream|null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const recMimeRef = useRef("audio/webm");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const startRecording = async () => {
    if (!activeId || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      recStreamRef.current = stream;
      const mime = ["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/aac","audio/ogg"].find(t => MediaRecorder.isTypeSupported(t)) || "";
      const rec = mime ? new MediaRecorder(stream,{mimeType:mime}) : new MediaRecorder(stream);
      recMimeRef.current = rec.mimeType || mime || "audio/webm";
      audioChunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size>0) audioChunksRef.current.push(e.data) };
      rec.start(); mediaRecRef.current = rec;
      setRecording(true); setRecordingSeconds(0);
      recTimerRef.current = setInterval(() => setRecordingSeconds(s => s+1), 1000);
    } catch {}
  };
  const cancelRecording = () => {
    const rec = mediaRecRef.current; if (rec && rec.state!=="inactive") { rec.onstop = null; rec.stop(); }
    recStreamRef.current?.getTracks().forEach(t => t.stop());
    recStreamRef.current = null; mediaRecRef.current = null; audioChunksRef.current = [];
    if (recTimerRef.current) clearInterval(recTimerRef.current); recTimerRef.current = null;
    setRecording(false); setRecordingSeconds(0);
  };
  const stopAndSendRecording = async () => {
    const rec = mediaRecRef.current; if (!rec || rec.state==="inactive") return;
    const dur = recordingSeconds; const mime = recMimeRef.current || "audio/webm";
    const blob = await new Promise<Blob>(resolve => { rec.onstop = () => resolve(new Blob(audioChunksRef.current,{type:mime})); rec.stop(); });
    recStreamRef.current?.getTracks().forEach(t => t.stop()); recStreamRef.current = null; mediaRecRef.current = null; audioChunksRef.current = [];
    if (recTimerRef.current) clearInterval(recTimerRef.current); recTimerRef.current = null; setRecording(false); setRecordingSeconds(0);
    if (!activeId || dur<1) return;
    setUploadingMedia(true);
    const ext = mime.includes("mp4")?"m4a":mime.includes("webm")?"webm":mime.includes("ogg")?"ogg":mime.includes("aac")?"aac":"webm";
    const path = `${activeId}/${myProfile.id}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, {cacheControl:"3600",contentType:mime});
    if (uploadErr) { setUploadingMedia(false); return; }
    const { data: publicUrl } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    await sendMediaMessage({type:"voice", url:publicUrl.publicUrl, duration:dur});
    setUploadingMedia(false);
  };

  // media file pick
  const handleMediaFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file || !activeId) return;
    if (file.size > MAX_IMAGE_BYTES) return;
    setUploadingMedia(true);
    const ext = file.name.split(".").pop()??"jpg";
    const path = `${activeId}/${myProfile.id}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {cacheControl:"3600", contentType:file.type||undefined});
    if (uploadErr) { setUploadingMedia(false); return; }
    const { data: publicUrl } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    await sendMediaMessage({type:"image", url:publicUrl.publicUrl});
    setUploadingMedia(false);
  };

  // send messages
  const [sending, setSending] = useState(false);
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault(); if (sending) return;
    const content = input.trim(); if (!content || !activeId) return;
    setSending(true); setInput("");
    activeChannelRef.current?.send({type:"broadcast",event:"typing",payload:{userId:myProfile.id,typing:false}});
    const replyTo = replyingTo; setReplyingTo(null);
    const tempId = `temp-${Date.now()}`;
    const optMsg: Message = {id:tempId, conversation_id:activeId, sender_id:myProfile.id, content, created_at:new Date().toISOString(), read_at:null, message_type:"text", reply_to_id:replyTo?.id??null};
    setMessages(prev => [...prev, optMsg]);
    const { data: inserted, error } = await supabase.from("messages").insert({conversation_id:activeId, sender_id:myProfile.id, content, message_type:"text", reply_to_id:replyTo?.id??null}).select().single();
    if (error || !inserted) { setMessages(prev => prev.filter(m => m.id!==tempId)); setInput(content); setReplyingTo(replyTo); setSending(false); return; }
    lastMsgCreatedRef.current = (inserted as Message).created_at; lastMsgIdRef.current = (inserted as Message).id;
    setMessages(prev => prev.some(m => m.id===(inserted as Message).id) ? prev.filter(m => m.id!==tempId) : prev.map(m => m.id===tempId ? (inserted as Message) : m));
    sendPushNotification({userId:active?.otherProfile?.id, title:myProfile.display_name, body:content, url:"/"});
    loadConversations(); setSending(false);
  };
  const sendMediaMessage = async (opts: {type:"image"|"voice"; url:string; duration?:number}) => {
    if (!activeId) return;
    const replyTo = replyingTo; setReplyingTo(null);
    const tempId = `temp-${Date.now()}`;
    const optMsg: Message = {id:tempId, conversation_id:activeId, sender_id:myProfile.id, content:"", created_at:new Date().toISOString(), read_at:null, message_type:opts.type, media_url:opts.url, media_duration:opts.duration??null, reply_to_id:replyTo?.id??null};
    setMessages(prev => [...prev, optMsg]);
    const { data: inserted, error } = await supabase.from("messages").insert({conversation_id:activeId, sender_id:myProfile.id, content:"", message_type:opts.type, media_url:opts.url, media_duration:opts.duration??null, reply_to_id:replyTo?.id??null}).select().single();
    if (error || !inserted) { setMessages(prev => prev.filter(m => m.id!==tempId)); return; }
    lastMsgCreatedRef.current = (inserted as Message).created_at; lastMsgIdRef.current = (inserted as Message).id;
    setMessages(prev => prev.some(m => m.id===(inserted as Message).id) ? prev.filter(m => m.id!==tempId) : prev.map(m => m.id===tempId ? (inserted as Message) : m));
    sendPushNotification({userId:active?.otherProfile?.id, title:myProfile.display_name, body:opts.type==="image"?"📷 Photo":"🎤 Voice message", url:"/"});
    loadConversations();
  };

  // status
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [myViewedStatusIds, setMyViewedStatusIds] = useState<Set<string>>(new Set());
  const loadStatuses = useCallback(async () => {
    const { data } = await supabase.from("statuses").select("*, profile:profiles(*)").gt("expires_at",new Date().toISOString()).order("created_at");
    setStatuses((data??[]) as any);
  }, [supabase]);
  useEffect(() => { loadStatuses(); const ch = supabase.channel("statuses-realtime").on("postgres_changes",{event:"*",schema:"public",table:"statuses"}, loadStatuses).subscribe(); return () => { supabase.removeChannel(ch) } }, [loadStatuses, supabase]);
  useEffect(() => { supabase.from("status_views").select("status_id").eq("viewer_id",myProfile.id).then(({data}) => setMyViewedStatusIds(new Set((data??[]).map((r:any) => r.status_id)))) }, [myProfile.id, supabase, statuses.length]);
  const myStatuses = statuses.filter(s => s.user_id===myProfile.id);
  const otherStatuses = statuses.filter(s => s.user_id!==myProfile.id).reduce((acc,s) => { acc[s.user_id] = [...(acc[s.user_id]??[]), s]; return acc }, {} as Record<string, Status[]>);
  const statusRingPropsFor = (userId: string) => {
    const list = userId===myProfile.id ? myStatuses : otherStatuses[userId]??[];
    if (!list.length) return { hasStatus:false, viewed:true };
    const allViewed = list.every(s => myViewedStatusIds.has(s.id));
    return { hasStatus:true, viewed:allViewed };
  };
  const markStatusViewed = async (statusId: string) => {
    if (myViewedStatusIds.has(statusId)) return;
    setMyViewedStatusIds(prev => new Set(prev).add(statusId));
    await supabase.from("status_views").upsert({status_id:statusId, viewer_id:myProfile.id}, {onConflict:"status_id,viewer_id", ignoreDuplicates:true});
  };

  // connect popup
  const [connectPopup, setConnectPopup] = useState<{target:Profile, mode:"ask"|"pending"|"declined"}|null>(null);
  const [connectSending, setConnectSending] = useState(false);
  const openConnectPopup = async (other: Profile) => {
    const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id",myProfile.id);
    const myIds = (mine??[]).map(r => r.conversation_id);
    if (myIds.length) {
      const { data: theirs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id",other.id).in("conversation_id",myIds);
      if (theirs?.length) { setSearch(""); setSearchResults([]); setMobileTab("chats"); setActiveId(theirs[0].conversation_id); return; }
    }
    const { data: existing } = await supabase.from("connection_requests").select("*").eq("from_user_id",myProfile.id).eq("to_user_id",other.id).maybeSingle();
    setConnectPopup({target:other, mode: existing?.status==="pending"?"pending":existing?.status==="declined"?"declined":"ask"});
  };
  const confirmConnect = async () => {
    if (!connectPopup) return;
    setConnectSending(true);
    await supabase.from("connection_requests").insert({from_user_id:myProfile.id, to_user_id:connectPopup.target.id});
    sendPushNotification({userId:connectPopup.target.id, title:myProfile.display_name, body:`${myProfile.display_name} wants to connect with you!`, url:"/"});
    setConnectSending(false); setConnectPopup(null); setSearch(""); setSearchResults([]);
  };

  // call
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callPeer, setCallPeer] = useState<Profile|null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit|null>(null);
  const [localStream, setLocalStream] = useState<MediaStream|null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream|null>(null);
  const [micOn, setMicOn] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const pcRef = useRef<RTCPeerConnection|null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const sendToUser = async (targetId: string, event: string, payload: any) => {
    const ch = supabase.channel(`calls:${targetId}`);
    await new Promise<void>(resolve => { ch.subscribe(status => { if (status==="SUBSCRIBED") resolve() }) });
    await ch.send({type:"broadcast", event, payload});
    setTimeout(() => supabase.removeChannel(ch), 500);
  };
  const endCall = (notify = true) => {
    if (notify && callPeer) sendToUser(callPeer.id, "hangup", {});
    pcRef.current?.close(); pcRef.current = null;
    localStream?.getTracks().forEach(t => t.stop()); setLocalStream(null); setRemoteStream(null);
    pendingCandidatesRef.current = []; setCallStatus("idle"); setCallPeer(null); setIncomingOffer(null); setMicOn(true);
  };
  useEffect(() => {
    const ch = supabase.channel(`calls:${myProfile.id}`)
      .on("broadcast",{event:"offer"}, ({payload}:any) => {
        if (payload.from===myProfile.id) return;
        setIncomingOffer(payload.offer);
        setCallPeer({id:payload.from, username:payload.fromUsername, display_name:payload.fromName, avatar_color:payload.fromColor, status:"", avatar_url:payload.fromAvatar});
        setCallStatus("incoming");
      })
      .on("broadcast",{event:"answer"}, async ({payload}:any) => {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        for (const c of pendingCandidatesRef.current) { try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
        pendingCandidatesRef.current = []; setCallStatus("connected");
      })
      .on("broadcast",{event:"ice-candidate"}, async ({payload}:any) => {
        if (!pcRef.current) return;
        if (pcRef.current.remoteDescription) { try { await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)) } catch {} }
        else pendingCandidatesRef.current.push(payload.candidate);
      })
      .on("broadcast",{event:"hangup"}, () => endCall(false))
      .subscribe();
    return () => { supabase.removeChannel(ch) };
  }, [myProfile.id, supabase]);

  const startCall = async () => {
    if (!active?.otherProfile || callStatus!=="idle") return;
    const peer = active.otherProfile;
    setCallPeer(peer); setCallStatus("outgoing");
    sendPushNotification({userId:peer.id, title:myProfile.display_name, body:"Incoming call…", url:"/"});
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      setLocalStream(stream); const pc = new RTCPeerConnection(ICE_SERVERS); pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => setRemoteStream(e.streams[0]);
      pc.onicecandidate = e => { if (e.candidate) sendToUser(peer.id, "ice-candidate", {candidate:e.candidate.toJSON()}) };
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      sendToUser(peer.id, "offer", {from:myProfile.id, fromName:myProfile.display_name, fromUsername:myProfile.username, fromColor:myProfile.avatar_color, fromAvatar:myProfile.avatar_url, offer});
    } catch { endCall(false) }
  };
  const acceptCall = async () => {
    if (!incomingOffer || !callPeer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      setLocalStream(stream); const pc = new RTCPeerConnection(ICE_SERVERS); pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = e => setRemoteStream(e.streams[0]);
      pc.onicecandidate = e => { if (e.candidate) sendToUser(callPeer.id, "ice-candidate", {candidate:e.candidate.toJSON()}) };
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      for (const c of pendingCandidatesRef.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
      await sendToUser(callPeer.id, "answer", {answer});
      setCallStatus("connected");
    } catch { endCall(true) }
  };
  const declineCall = () => endCall(true);
  const toggleMic = () => { localStream?.getAudioTracks().forEach(t => t.enabled = !micOn); setMicOn(v => !v) };
  const formatCallTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  useEffect(() => {
    if (callStatus==="connected") { setCallSeconds(0); callTimerRef.current = setInterval(() => setCallSeconds(s => s+1), 1000) }
    else { if (callTimerRef.current) clearInterval(callTimerRef.current); callTimerRef.current = null; }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current) };
  }, [callStatus]);

  // other helpers
  const active = conversations.find(c => c.id===activeId);
  const [otherProfileFresh, setOtherProfileFresh] = useState<Profile|null>(null);
  useEffect(() => {
    const otherId = active?.otherProfile?.id; if (!otherId) { setOtherProfileFresh(null); return; }
    let cancelled = false;
    (async () => { const { data } = await supabase.from("profiles").select("*").eq("id",otherId).single(); if (!cancelled) setOtherProfileFresh(data??null) })();
    return () => { cancelled=true };
  }, [active?.otherProfile?.id, supabase]);
  useEffect(() => { if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream }, [remoteStream]);
  useEffect(() => { supabase.auth.getUser().then(({data}) => { if (data.user?.email) setMyEmail(data.user.email) }) }, [supabase]);
  useEffect(() => { subscribeToPush(myProfile.id) }, [myProfile.id]);
  useEffect(() => { const update = () => supabase.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",myProfile.id); update(); const i = setInterval(update,20000); return () => clearInterval(i) }, [myProfile.id, supabase]);
  useEffect(() => { setShowContactInfo(false) }, [activeId]);
  useEffect(() => { if (recording) cancelRecording() }, [activeId]);
  // read receipts
  useEffect(() => {
    if (!activeId) return;
    const unreadIds = messages.filter(m => m.sender_id!==myProfile.id && !m.read_at && !m.id.startsWith("temp-")).map(m => m.id);
    if (unreadIds.length) supabase.from("messages").update({read_at:new Date().toISOString()}).in("id",unreadIds).then(() => loadConversations());
  }, [messages, activeId, myProfile.id, supabase, loadConversations]);
  // online presence
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ch = supabase.channel("presence:online",{config:{presence:{key:myProfile.id}}});
    ch.on("presence",{event:"sync"}, () => setOnlineIds(new Set(Object.keys(ch.presenceState()))))
      .subscribe(async status => { if (status==="SUBSCRIBED") await ch.track({online_at:new Date().toISOString()}) });
    return () => { supabase.removeChannel(ch) };
  }, [myProfile.id, supabase]);

  // profile
  const [nameDraft, setNameDraft] = useState(initialProfile.display_name);
  const [bioDraft, setBioDraft] = useState(initialProfile.bio??"");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop()??"jpg"; const path = `${myProfile.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(path,file,{cacheControl:"3600",upsert:true});
    if (uploadErr) { setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({avatar_url:pub.publicUrl}).eq("id",myProfile.id);
    setMyProfile(prev => ({...prev, avatar_url:pub.publicUrl})); setUploading(false);
  };
  const saveDisplayName = async () => {
    const trimmed = nameDraft.trim(); if (!trimmed || trimmed===myProfile.display_name) return;
    await supabase.from("profiles").update({display_name:trimmed}).eq("id",myProfile.id);
    setMyProfile(prev => ({...prev, display_name:trimmed}));
  };
  const saveBio = async () => {
    const trimmed = bioDraft.trim(); if (trimmed===(myProfile.bio??"")) return;
    await supabase.from("profiles").update({bio:trimmed}).eq("id",myProfile.id);
    setMyProfile(prev => ({...prev, bio:trimmed}));
  };
  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh() };

  // status viewer
  const [statusViewerUserId, setStatusViewerUserId] = useState<string|null>(null);
  const [statusViewerIndex, setStatusViewerIndex] = useState(0);
  const [showTextStatusComposer, setShowTextStatusComposer] = useState(false);
  const [textStatusDraft, setTextStatusDraft] = useState("");
  const [textStatusColor, setTextStatusColor] = useState(STATUS_COLORS[0]);
  const statusFileInputRef = useRef<HTMLInputElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const openStatusViewer = (userId: string) => { setStatusViewerUserId(userId); setStatusViewerIndex(0) };
  const closeStatusViewer = () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); setStatusViewerUserId(null); setStatusViewerIndex(0) };
  const advanceStatus = (dir:1|-1) => {
    if (!statusViewerUserId) return;
    const list = statusViewerUserId===myProfile.id ? myStatuses : otherStatuses[statusViewerUserId]??[];
    const next = statusViewerIndex + dir;
    if (next<0 || next>=list.length) { closeStatusViewer(); return; }
    setStatusViewerIndex(next);
  };
  useEffect(() => {
    if (!statusViewerUserId) return;
    const list = statusViewerUserId===myProfile.id ? myStatuses : otherStatuses[statusViewerUserId]??[];
    const current = list[statusViewerIndex]; if (!current) { closeStatusViewer(); return; }
    markStatusViewed(current.id);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => advanceStatus(1), STATUS_DURATION_MS);
    return () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current) };
  }, [statusViewerUserId, statusViewerIndex, statuses]);

  const handleStatusFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file || file.size > MAX_IMAGE_BYTES) return;
    const [uploadingStatus, setUploadingStatus] = useState(false);
    setUploadingStatus(true);
    const ext = file.name.split(".").pop()??"jpg"; const path = `${myProfile.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(STATUS_MEDIA_BUCKET).upload(path,file,{cacheControl:"3600",contentType:file.type||undefined});
    if (uploadErr) { setUploadingStatus(false); return; }
    const { data: pub } = supabase.storage.from(STATUS_MEDIA_BUCKET).getPublicUrl(path);
    await supabase.from("statuses").insert({user_id:myProfile.id, media_url:pub.publicUrl});
    setUploadingStatus(false); loadStatuses();
  };
  const postTextStatus = async () => {
    if (!textStatusDraft.trim()) return;
    await supabase.from("statuses").insert({user_id:myProfile.id, text_content:textStatusDraft.trim(), bg_color:textStatusColor});
    setTextStatusDraft(""); setShowTextStatusComposer(false); loadStatuses();
  };
  const deleteStatus = async (id: string) => { await supabase.from("statuses").delete().eq("id",id); closeStatusViewer(); loadStatuses() };

  // swipe reply
  const swipeStartRef = useRef<{id:string,x:number,y:number}|null>(null);
  const [swipeState, setSwipeState] = useState<{id:string,dx:number}|null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string|null>(null);
  const onBubbleTouchStart = (e: React.TouchEvent, m: Message) => {
    setReactionPickerFor(null); swipeStartRef.current = {id:m.id, x:e.touches[0].clientX, y:e.touches[0].clientY};
  };
  const onBubbleTouchMove = (e: React.TouchEvent, m: Message) => {
    const start = swipeStartRef.current; if (!start || start.id!==m.id) return;
    const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    setSwipeState({id:m.id, dx:Math.max(0, Math.min(dx, SWIPE_REPLY_MAX))});
  };
  const onBubbleTouchEnd = (m: Message) => {
    const state = swipeState; swipeStartRef.current = null; setSwipeState(null);
    if (state && state.id===m.id && state.dx > SWIPE_REPLY_THRESHOLD) setReplyingTo(m);
  };

  const messageById = (id?: string|null) => id ? messages.find(m => m.id===id)??null : null;
  const previewForQuote = (m: Message|null) => {
    if (!m) return "Message";
    if (m.message_type==="image") return "📷 Photo";
    if (m.message_type==="voice") return "🎤 Voice message";
    return m.content;
  };

  const otherIsOnline = active?.otherProfile ? onlineIds.has(active.otherProfile.id) : false;
  const otherDisplayProfile = otherProfileFresh ?? active?.otherProfile ?? null;
  const activeStatusList = statusViewerUserId ? (statusViewerUserId===myProfile.id ? myStatuses : otherStatuses[statusViewerUserId]??[]) : [];
  const activeStatusItem = activeStatusList[statusViewerIndex] ?? null;
  const activeStatusProfile = activeStatusItem?.profile ?? (statusViewerUserId===myProfile.id ? myProfile : active?.otherProfile) ?? null;

  // ---------- JSX ----------
  return (
    <div className="relative flex w-full overflow-x-hidden bg-ink-900 text-[color:var(--color-text)]" style={{height:"var(--app-height,100dvh)"}}>
      <style>{`@keyframes typingDot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-5px)}}@keyframes ciSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <audio ref={remoteAudioRef} autoPlay/>

      {/* connect popup */}
      {connectPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}}>
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-800 p-6 shadow-2xl">
            <div className="flex flex-col items-center gap-3 pb-5">
              <Avatar name={connectPopup.target.display_name} color={connectPopup.target.avatar_color} size={72} avatarUrl={connectPopup.target.avatar_url}/>
              <div className="text-center"><p className="flex items-center justify-center font-display text-lg font-bold">{connectPopup.target.display_name}{isVerified(connectPopup.target.username)&&<VerifiedBadge size={16}/>}</p><p className="text-sm text-mist">@{connectPopup.target.username}</p></div>
            </div>
            <div className="mb-6 h-px w-full bg-white/10"/>
            {connectPopup.mode==="ask" && (
              <>
                <p className="mb-6 text-center text-sm text-[color:var(--color-text)]/80">Do you want to connect with <span className="font-semibold text-white">{connectPopup.target.display_name}</span>?</p>
                <div className="flex gap-3">
                  <button onClick={()=>setConnectPopup(null)} className="flex-1 rounded-full border border-white/10 py-3 text-sm font-semibold text-mist transition hover:border-white/30 hover:text-white">Cancel</button>
                  <button onClick={confirmConnect} disabled={connectSending} className="flex-1 rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-50">{connectSending?"Sending…":"Yes, Connect"}</button>
                </div>
              </>
            )}
            {connectPopup.mode==="pending" && (
              <>
                <div className="mb-6 flex flex-col items-center gap-2"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet/15 text-2xl">⏳</span><p className="text-center text-sm">You already sent a request. Waiting for them to accept.</p></div>
                <button onClick={()=>setConnectPopup(null)} className="w-full rounded-full border border-white/10 py-3 text-sm font-semibold text-mist">OK</button>
              </>
            )}
            {connectPopup.mode==="declined" && (
              <>
                <div className="mb-6 flex flex-col items-center gap-2"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-2xl">😔</span><p className="text-center text-sm">{connectPopup.target.display_name} has declined your request.</p></div>
                <button onClick={()=>setConnectPopup(null)} className="w-full rounded-full border border-white/10 py-3 text-sm font-semibold text-mist">OK</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* call UI */}
      {callStatus!=="idle" && callPeer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0A0C12]">
          <div className="pointer-events-none absolute inset-0 bg-aurora"/>
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Avatar name={callPeer.display_name} color={callPeer.avatar_color} size={120} avatarUrl={callPeer.avatar_url}/>
            <p className="mt-5 flex items-center font-display text-xl font-bold text-white">{callPeer.display_name}{isVerified(callPeer.username)&&<VerifiedBadge size={18}/>}</p>
            <p className="mt-2 text-sm text-mist">{callStatus==="outgoing"?"Calling…":callStatus==="incoming"?"Incoming call…":formatCallTime(callSeconds)}</p>
          </div>
          <div className="relative z-10 flex items-center justify-center gap-6 pb-12">
            {callStatus==="incoming"? (
              <>
                <button onClick={declineCall} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg" aria-label="Decline"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg></button>
                <button onClick={acceptCall} className="flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white shadow-lg" aria-label="Accept"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>
              </>
            ) : (
              <>
                {callStatus==="connected" && <button onClick={toggleMic} className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg ${micOn?"bg-white/10":"bg-white text-ink-900"}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>}
                <button onClick={()=>endCall(true)} className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg" aria-label="End call"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg></button>
              </>
            )}
          </div>
        </div>
      )}

      {/* status viewer */}
      {statusViewerUserId && activeStatusItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex gap-1 px-3 pt-3">{activeStatusList.map((s,i)=><div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"><div className="h-full bg-white" style={{width:i<=statusViewerIndex?"100%":"0%"}}/></div>)}</div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar name={activeStatusProfile?.display_name??""} color={activeStatusProfile?.avatar_color??"#7C5CFF"} avatarUrl={activeStatusProfile?.avatar_url} size={36}/>
            <div className="min-w-0 flex-1"><p className="flex items-center text-sm font-semibold text-white"><span className="truncate">{activeStatusProfile?.display_name}</span>{isVerified(activeStatusProfile?.username)&&<VerifiedBadge/>}</p><p className="text-xs text-white/60">{formatLastSeen(activeStatusItem.created_at)}</p></div>
            {activeStatusItem.user_id===myProfile.id && <button onClick={()=>deleteStatus(activeStatusItem.id)} className="text-xs font-medium text-white/70 hover:text-white">Delete</button>}
            <button onClick={closeStatusViewer} className="px-2 text-xl leading-none text-white">✕</button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <button className="absolute left-0 top-0 z-10 h-full w-1/3" onClick={()=>advanceStatus(-1)}/>
            <button className="absolute right-0 top-0 z-10 h-full w-1/3" onClick={()=>advanceStatus(1)}/>
            {activeStatusItem.media_url ? <img src={activeStatusItem.media_url} alt="Status" className="max-h-full max-w-full object-contain"/> :
            <div className="flex h-full w-full items-center justify-center p-8" style={{background:activeStatusItem.bg_color??"#7C5CFF"}}><p className="break-words text-center text-2xl font-semibold text-white">{activeStatusItem.text_content}</p></div>}
          </div>
        </div>
      )}

      {/* text status composer */}
      {showTextStatusComposer && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{background:textStatusColor}}>
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={()=>{setShowTextStatusComposer(false);setTextStatusDraft("")}} className="text-xl text-white">✕</button>
            <button onClick={postTextStatus} disabled={!textStatusDraft.trim()} className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Post</button>
          </div>
          <div className="flex flex-1 items-center justify-center px-8"><textarea autoFocus value={textStatusDraft} onChange={e=>setTextStatusDraft(e.target.value.slice(0,200))} placeholder="Type a status…" rows={4} className="w-full resize-none bg-transparent text-center text-2xl font-semibold text-white placeholder:text-white/60 outline-none"/></div>
          <div className="flex justify-center gap-3 pb-8">{STATUS_COLORS.map(c=><button key={c} onClick={()=>setTextStatusColor(c)} className={`h-8 w-8 rounded-full transition ${textStatusColor===c?"ring-2 ring-white ring-offset-2 ring-offset-black/20":""}`} style={{background:c}}/>)}</div>
        </div>
      )}

      {/* sidebar */}
      <aside className={`${activeId?"hidden md:flex":"flex"} w-full md:max-w-xs flex-col border-r border-black/5 dark:border-white/5 bg-ink-800/60`}>
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-2xl font-bold">Aira<span className="text-gradient">Think</span></span>
          <div className="relative">
            <button onClick={()=>setShowNotifications(v=>!v)} className="relative flex h-9 w-9 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {notifications.length>0 && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{notifications.length>9?"9+":notifications.length}</span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-white/10 bg-ink-800 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><p className="text-sm font-semibold">Notifications</p><button onClick={()=>setShowNotifications(false)} className="text-mist hover:text-white">✕</button></div>
                {!notifications.length ? <p className="px-4 py-6 text-center text-xs text-mist">No new notifications</p> :
                <div className="max-h-96 overflow-y-auto">{notifications.map(req=><div key={req.id} className="border-b border-white/5 px-4 py-3"><div className="flex items-center gap-3"><Avatar name={req.from_profile?.display_name??"User"} color={req.from_profile?.avatar_color??"#7C5CFF"} avatarUrl={req.from_profile?.avatar_url} size={36}/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">{req.from_profile?.display_name} wants to connect!</p><p className="mt-0.5 text-[10px] text-mist">@{req.from_profile?.username}</p></div></div><div className="mt-2.5 flex gap-2"><button onClick={()=>acceptRequest(req)} className="flex-1 rounded-full bg-gradient-to-r from-violet to-violet-light py-1.5 text-xs font-semibold text-white">Accept</button><button onClick={()=>declineRequest(req)} className="flex-1 rounded-full border border-white/10 py-1.5 text-xs font-semibold text-mist hover:text-white">Leave</button></div></div>)}</div>}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {mobileTab==="home" && (
            <div className="flex h-full flex-col overflow-y-auto px-8 pb-10 text-center">
              <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
              <div className="flex flex-col items-center pt-10">
                <div className="glass animate-floatSlow mb-6 flex h-20 w-20 items-center justify-center rounded-3xl">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="url(#homeGrad)" strokeWidth="1.6" strokeLinejoin="round"/><defs><linearGradient id="homeGrad" x1="3" y1="3" x2="21" y2="21"><stop stopColor="#9C82FF"/><stop offset="1" stopColor="#22D3B8"/></linearGradient></defs></svg>
                </div>
                <h2 className="font-display text-2xl font-bold">Welcome to <span className="text-gradient">AiraThink</span>!</h2>
                <p className="mt-2 text-sm text-mist">Let's connect. Real conversations, real time.</p>
                <button onClick={()=>setMobileTab("search")} className="mt-6 rounded-full bg-gradient-to-r from-violet to-violet-light px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet/30">Start a conversation</button>
                {conversations.length>0 && <button onClick={()=>setMobileTab("chats")} className="mt-3 text-xs font-medium text-mist transition hover:text-black dark:hover:text-white">Or go to your chats →</button>}
              </div>
              <div className="mt-10 flex flex-col gap-3 text-left">{HOME_FEATURES.map((f,i)=><div key={f.title} className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 opacity-0" style={{animation:`fadeUp .6s ease-out ${.15+i*.12}s forwards`}}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet/15 text-lg">{f.icon}</span><div><p className="text-sm font-semibold">{f.title}</p><p className="text-xs text-mist">{f.desc}</p></div></div>)}</div>
            </div>
          )}

          {mobileTab==="status" && (
            <div className="px-2 pb-4">
              <input ref={statusFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleStatusFilePick}/>
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="relative">
                  {myStatuses.length>0 ? <button onClick={()=>openStatusViewer(myProfile.id)}><StatusRing {...statusRingPropsFor(myProfile.id)}><Avatar name={myProfile.display_name} color={myProfile.avatar_color} avatarUrl={myProfile.avatar_url} size={64}/></StatusRing></button> : <Avatar name={myProfile.display_name} color={myProfile.avatar_color} avatarUrl={myProfile.avatar_url} size={64}/>}
                  <button onClick={()=>statusFileInputRef.current?.click()} disabled={uploadingStatus} className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-800 bg-violet text-white disabled:opacity-50"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.4" strokeLinecap="round"/></svg></button>
                </div>
                <button onClick={()=>myStatuses.length>0?openStatusViewer(myProfile.id):setShowTextStatusComposer(true)} className="flex-1 text-left"><p className="text-base font-semibold">My Status</p><p className="text-sm text-mist">{uploadingStatus?"Uploading…":myStatuses.length>0?"Tap to view":"Tap to add a status update"}</p></button>
                <button onClick={()=>setShowTextStatusComposer(true)} className="rounded-full px-3 py-1.5 text-xs font-medium text-violet-light transition hover:bg-black/5 dark:hover:bg-white/5">Aa</button>
              </div>
              {Object.keys(otherStatuses).length>0 && <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-mist/70">Recent updates</p>}
              {Object.entries(otherStatuses).map(([userId,list])=>{
                const p = list[0].profile, latest = list[list.length-1], ring = statusRingPropsFor(userId);
                return <button key={userId} onClick={()=>openStatusViewer(userId)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/5 dark:hover:bg-white/5"><StatusRing {...ring}><Avatar name={p?.display_name??"Unknown"} color={p?.avatar_color??"#7C5CFF"} avatarUrl={p?.avatar_url} size={64}/></StatusRing><div className="min-w-0 flex-1"><p className="flex items-center truncate text-base font-semibold"><span className="truncate">{p?.display_name??"Unknown"}</span>{isVerified(p?.username)&&<VerifiedBadge/>}</p><p className="text-sm text-mist">{formatLastSeen(latest.created_at)}</p></div></button>
              })}
            </div>
          )}

          {mobileTab==="chats" && (
            <div className="px-2 pb-4">
              {loadingConvos && <p className="px-3 py-2 text-xs text-mist">Loading…</p>}
              {!loadingConvos && !conversations.length && <p className="px-3 py-6 text-center text-sm text-mist">No conversations yet. Tap Search to start one.</p>}
              {conversations.map(c => {
                const name = c.is_group ? c.name??"Group" : c.otherProfile?.display_name??"Unknown";
                const color = c.otherProfile?.avatar_color??"#7C5CFF";
                const online = c.otherProfile ? onlineIds.has(c.otherProfile.id) : false;
                const ring = c.otherProfile ? statusRingPropsFor(c.otherProfile.id) : {hasStatus:false,viewed:true};
                return <button key={c.id} onClick={()=>{setActiveId(c.id);setMobileTab("chats")}} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${activeId===c.id?"bg-violet/15":"hover:bg-black/5 dark:hover:bg-white/5"}`}>
                  <StatusRing {...ring}><Avatar name={name} color={color} online={online} avatarUrl={c.otherProfile?.avatar_url} size={56}/></StatusRing>
                  <div className="min-w-0 flex-1"><p className="flex items-center truncate text-lg font-semibold"><span className="truncate">{name}</span>{isVerified(c.otherProfile?.username)&&<VerifiedBadge size={16}/>}</p><p className="truncate text-sm text-mist">{c.lastMessage}</p></div>
                  {c.unreadCount>0 && <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-teal px-1.5 text-xs font-bold text-[#0A0C12]">{c.unreadCount>99?"99+":c.unreadCount}</span>}
                </button>
              })}
            </div>
          )}

          {mobileTab==="search" && (
            <div className="p-4">
              <input autoFocus value={search} onChange={e=>handleSearch(e.target.value)} placeholder="Search by username…" className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-ink-800 px-3 py-2 text-sm placeholder:text-mist/50 focus:border-violet focus:outline-none"/>
              <div className="mt-3">
                {searchResults.map(r=><button key={r.id} onClick={()=>openConnectPopup(r)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5"><Avatar name={r.display_name} color={r.avatar_color} size={36} avatarUrl={r.avatar_url}/><div className="min-w-0 flex-1"><p className="flex items-center font-semibold">{r.display_name}{isVerified(r.username)&&<VerifiedBadge/>}</p><p className="text-xs text-mist">@{r.username}</p></div></button>)}
                {search.trim().length>=2 && !searchResults.length && <p className="px-2 py-2 text-xs text-mist">No users found.</p>}
              </div>
            </div>
          )}

          {mobileTab==="profile" && (
            <div className="px-5 py-6">
              <h2 className="mb-6 text-center font-display text-lg font-bold">Edit Profile</h2>
              <div className="flex flex-col items-center">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick}/>
                <button onClick={()=>fileInputRef.current?.click()} className="group relative" disabled={uploading}>
                  <Avatar name={myProfile.display_name} color={myProfile.avatar_color} size={96} avatarUrl={myProfile.avatar_url}/>
                  <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-800 bg-violet text-white shadow-lg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="12" cy="13" r="3" stroke="white" strokeWidth="1.6"/></svg></span>
                </button>
                <p className="mt-2 text-xs text-mist">{uploading?"Uploading…":"Tap photo to change"}</p>
              </div>
              <div className="glass mt-6 divide-y divide-black/5 dark:divide-white/5 overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between px-4 py-3.5"><span className="text-xs font-medium text-mist">Full name</span><input value={nameDraft} onChange={e=>setNameDraft(e.target.value)} className="w-40 bg-transparent text-right text-sm outline-none"/></div>
                <div className="flex items-center justify-between px-4 py-3.5"><span className="text-xs font-medium text-mist">Email</span><span className="truncate text-sm">{myEmail||"—"}</span></div>
                <div className="flex items-center justify-between px-4 py-3.5"><span className="text-xs font-medium text-mist">Username</span><span className="inline-flex items-center text-sm">@{myProfile.username}{isVerified(myProfile.username)&&<VerifiedBadge/>}</span></div>
                <button onClick={handleLogout} className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-black/5 dark:hover:bg-white/5"><span className="text-xs font-medium text-mist">Account</span><span className="text-sm font-medium text-red-400">Log out</span></button>
              </div>
              <div className="glass mt-4 rounded-2xl px-4 py-3.5">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-mist">Bio</span><span className="text-[10px] text-mist/70">{bioDraft.length}/{MAX_BIO_LENGTH}</span></div>
                <textarea value={bioDraft} onChange={e=>setBioDraft(e.target.value.slice(0,MAX_BIO_LENGTH))} placeholder="Write something about yourself…" rows={3} className="mt-2 w-full resize-none bg-transparent text-sm placeholder:text-mist/50 outline-none"/>
              </div>
              <button onClick={()=>{saveDisplayName();saveBio()}} disabled={(!nameDraft.trim()||nameDraft.trim()===myProfile.display_name)&&bioDraft.trim()===(myProfile.bio??"")} className="mt-6 w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-40">Save Changes</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 border-t border-black/5 dark:border-white/5 bg-ink-800/80">
          {(["home","status","chats","search","profile"] as MobileTab[]).map(tab=><button key={tab} onClick={()=>setMobileTab(tab)} className={`flex flex-col items-center gap-1.5 py-3.5 text-sm font-medium capitalize transition ${mobileTab===tab?"text-violet-light":"text-mist"}`}><TabIcon tab={tab}/>{tab}</button>)}
        </div>
      </aside>

      {/* main chat area */}
      <section className={`${activeId?"flex":"hidden md:flex"} relative min-w-0 flex-1 flex-col`}>
        <div className="pointer-events-none absolute inset-0 bg-aurora opacity-40"/>
        {!active ? (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
            <div className="glass animate-floatSlow mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"><svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="#9C82FF" strokeWidth="1.6" strokeLinejoin="round"/></svg></div>
            <h2 className="font-display text-xl font-semibold">Pick a conversation</h2>
            <p className="mt-1 max-w-xs text-sm text-mist">Or start a new one from Search — your messages sync in real time.</p>
          </div>
        ) : showContactInfo ? (
          <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
            <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full opacity-30" style={{background:`radial-gradient(circle, ${otherDisplayProfile?.avatar_color??"#7C5CFF"}55 0%, transparent 70%)`}}/>
            <header className="glass relative z-10 flex items-center gap-3 border-b border-white/5 px-4 py-4">
              <button onClick={()=>setShowContactInfo(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-mist transition hover:bg-white/5 hover:text-white" aria-label="Back to chat"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
              <p className="text-sm font-semibold text-white/80">Contact info</p>
            </header>
            <div className="relative z-10 flex flex-col items-center px-6 pt-8 pb-6 text-center" style={{animation:"ciSlideUp .35s ease-out forwards"}}>
              <div className="mb-4 rounded-full p-[3px]" style={{background:"linear-gradient(135deg, #7C5CFF, #22D3B8)"}}>
                <div className="rounded-full border-[3px] border-[#0A0C12]"><Avatar name={active.is_group?active.name??"Group":otherDisplayProfile?.display_name??"Unknown"} color={otherDisplayProfile?.avatar_color??"#7C5CFF"} size={100} avatarUrl={otherDisplayProfile?.avatar_url}/></div>
              </div>
              <h2 className="flex items-center font-display text-xl font-bold text-white">{active.is_group?active.name??"Group":otherDisplayProfile?.display_name??"Unknown"}{isVerified(otherDisplayProfile?.username)&&<VerifiedBadge size={18}/>}</h2>
              {!active.is_group && <p className="mt-1 text-sm text-white/45">@{otherDisplayProfile?.username}</p>}
              {!active.is_group && <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><span className={`h-2 w-2 rounded-full ${otherIsOnline?"bg-teal":"bg-white/25"}`}/><span className="text-xs text-white/60">{otherIsOnline?"Active now":otherDisplayProfile?.last_seen?`Last seen ${formatLastSeen(otherDisplayProfile.last_seen)}`:"Offline"}</span></div>}
              {otherDisplayProfile?.bio && <p className="mt-4 max-w-xs whitespace-pre-wrap text-sm leading-relaxed text-white/60">{otherDisplayProfile.bio}</p>}
            </div>
            {!active.is_group && <div className="relative z-10 flex gap-3 px-5 pb-5">
              <button onClick={()=>setShowContactInfo(false)} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 py-3.5 text-white/75 transition hover:bg-white/8"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.75-.9L3 21l1.9-5.75A8.47 8.47 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg><span className="text-[11px] font-semibold tracking-wide">Message</span></button>
              <button onClick={()=>{setShowContactInfo(false);startCall()}} disabled={callStatus!=="idle"} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 py-3.5 text-white/75 transition hover:bg-white/8 disabled:opacity-40"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg><span className="text-[11px] font-semibold tracking-wide">Call</span></button>
              <button onClick={()=>setContactMuted(v=>!v)} className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-white/4 py-3.5 text-white/75 transition hover:bg-white/8">{contactMuted?<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0M2 2l20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}<span className="text-[11px] font-semibold tracking-wide">{contactMuted?"Unmute":"Mute"}</span></button>
            </div>}
            <div className="relative z-10 mx-5 mb-4 h-px bg-white/6"/>
            <div className="relative z-10 flex flex-col gap-2 px-5 pb-8">
              <button onClick={()=>setContactBlocked(v=>!v)} className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-semibold transition" style={{background:contactBlocked?"rgba(248,113,113,0.10)":"rgba(255,255,255,0.03)",borderColor:contactBlocked?"rgba(248,113,113,0.25)":"rgba(255,255,255,0.07)",color:"#F87171"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M5.5 5.5l13 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>{contactBlocked?"Unblock User":"Block User"}</button>
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/7 bg-white/3 py-3.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/8"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>Delete Chat</button>
            </div>
          </div>
        ) : (
          <>
            <header className="glass relative z-10 flex items-center gap-3 border-b border-black/5 dark:border-white/5 px-4 py-4 md:px-6">
              <button onClick={()=>setActiveId(null)} className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white md:hidden"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
              <button onClick={()=>setShowContactInfo(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left transition hover:bg-black/5 dark:hover:bg-white/5">
                <Avatar name={active.is_group?active.name??"Group":active.otherProfile?.display_name??"Unknown"} color={active.otherProfile?.avatar_color??"#7C5CFF"} online={otherIsOnline} avatarUrl={active.otherProfile?.avatar_url}/>
                <div className="min-w-0 flex-1"><p className="flex items-center text-sm font-semibold"><span className="truncate">{active.is_group?active.name??"Group":active.otherProfile?.display_name??"Unknown"}</span>{isVerified(active.otherProfile?.username)&&<VerifiedBadge/>}</p>
                {!active.is_group && <p className="truncate text-xs text-mist">{peerTyping?<span className="text-teal animate-pulse">typing…</span>:otherIsOnline?<span className="text-teal">Active now</span>:otherProfileFresh?.last_seen?`Last seen ${formatLastSeen(otherProfileFresh.last_seen)}`:`@${active.otherProfile?.username}`}</p>}</div>
              </button>
              {!active.is_group && <button onClick={startCall} disabled={callStatus!=="idle"} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet to-violet-light text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-40" aria-label="Voice call"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 5c0-1 1-2 2-2l3 3-1.5 3a13 13 0 0 0 6.5 6.5l3-1.5 3 3c0 1-1 2-2 2C11 19 5 13 4 5Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>}
            </header>

            <div ref={scrollRef} onScroll={handleMessagesScroll} className="relative z-10 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-6 py-6">
              {loadingMore && <p className="pb-2 text-center text-xs text-mist">Loading older messages…</p>}
              {messages.map((m,idx)=>{
                const mine = m.sender_id===myProfile.id;
                const isImage = m.message_type==="image" && !!m.media_url;
                const isVoice = m.message_type==="voice" && !!m.media_url;
                const quoted = messageById(m.reply_to_id);
                const isSwiping = swipeState?.id===m.id;
                const translateX = isSwiping ? swipeState!.dx : 0;
                const prevMsg = messages[idx-1];
                const showDay = !prevMsg || formatDayLabel(prevMsg.created_at)!==formatDayLabel(m.created_at);
                const grouped = !!prevMsg && !showDay && prevMsg.sender_id===m.sender_id && (new Date(m.created_at).getTime()-new Date(prevMsg.created_at).getTime())<GROUPED_GAP_MS;
                return (
                  <Fragment key={m.id}>
                    {showDay && <div className="my-4 flex items-center justify-center"><span className="rounded-full border border-black/5 bg-black/5 px-3 py-1 text-[11px] text-mist dark:border-white/10 dark:bg-white/5">{formatDayLabel(m.created_at)}</span></div>}
                    <div className={`relative flex ${mine?"justify-end":"justify-start"} ${grouped?"mt-0.5":"mt-2.5"}`} onTouchStart={e=>onBubbleTouchStart(e,m)} onTouchMove={e=>onBubbleTouchMove(e,m)} onTouchEnd={()=>onBubbleTouchEnd(m)}>
                      {isSwiping && translateX>12 && <span className="absolute left-0 top-1/2 -translate-y-1/2 text-violet-light" style={{opacity:Math.min(1,translateX/SWIPE_REPLY_THRESHOLD)}}>↩</span>}
                      <div style={{transform:`translateX(${translateX}px)`,transition:isSwiping?"none":"transform .15s ease-out"}} className="max-w-[80%] md:max-w-md" onDoubleClick={()=>toggleReaction(m.id,"❤️")} onContextMenu={e=>{e.preventDefault();setReactionPickerFor(reactionPickerFor===m.id?null:m.id)}}>
                        {reactionPickerFor===m.id && <div className={`mb-1 flex gap-1 rounded-full bg-ink-800 px-2 py-1 shadow-lg ${mine?"justify-end":"justify-start"}`}>{QUICK_EMOJIS.map(emo=><button key={emo} onClick={()=>toggleReaction(m.id,emo)} className="text-lg leading-none hover:scale-110 transition">{emo}</button>)}</div>}
                        <div className={`text-sm ${isImage?"overflow-hidden rounded-2xl p-1":"rounded-2xl px-4 py-2.5"} ${mine?`${isImage?"":"bg-gradient-to-br from-violet to-violet-dark"} rounded-br-sm text-white shadow-md shadow-violet/20`:`${isImage?"":"glass"} rounded-bl-sm text-[color:var(--color-text)]`}`}>
                          {quoted && <div className={`mb-1.5 rounded-lg border-l-2 border-violet-light bg-black/25 px-2 py-1 text-xs ${isImage?"mx-2 mt-2":""}`}><p className="font-medium text-violet-light">{quoted.sender_id===myProfile.id?"You":active.otherProfile?.display_name??"Message"}</p><p className="truncate text-white/70">{previewForQuote(quoted)}</p></div>}
                          {isImage ? <img src={m.media_url!} alt="Shared photo" className="max-h-72 w-full cursor-pointer rounded-xl object-cover" onClick={()=>window.open(m.media_url!,"_blank")}/> : isVoice ? <VoiceMessage url={m.media_url!} duration={m.media_duration??0} mine={mine}/> : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                          <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine?"text-white/60":"text-mist"} ${isImage?"px-2 pb-1":""}`}>{new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}{mine && <Ticks read={!!m.read_at}/>}</p>
                        </div>
                        <ReactionPills msgReactions={reactionsByMsg[m.id]??[]} myId={myProfile.id} onToggle={emoji=>toggleReaction(m.id,emoji)}/>
                      </div>
                    </div>
                  </Fragment>
                )})}
              {peerTyping && !active.is_group && <div className="mt-2.5"><TypingBubble/></div>}
              {!messages.length && !peerTyping && <p className="pt-10 text-center text-sm text-mist">No messages yet — say hello 👋</p>}
            </div>

            {replyingTo && (
              <div className="relative z-10 flex items-center justify-between border-t border-black/5 dark:border-white/5 bg-ink-800/60 px-6 py-2">
                <div className="min-w-0 flex-1 border-l-2 border-violet-light pl-2"><p className="text-xs font-medium text-violet-light">Replying to {replyingTo.sender_id===myProfile.id?"yourself":active.otherProfile?.display_name??"message"}</p><p className="truncate text-xs text-mist">{previewForQuote(replyingTo)}</p></div>
                <button onClick={()=>setReplyingTo(null)} className="ml-3 shrink-0 text-mist hover:text-black dark:hover:text-white">✕</button>
              </div>
            )}

            {/* redesigned input bar */}
            <form onSubmit={sendMessage} className="relative z-10 border-t border-white/5 bg-gradient-to-t from-ink-900 via-ink-900/95 to-transparent px-4 py-3">
              <input ref={mediaInputRef} type="file" accept="image/*" className="hidden" onChange={handleMediaFilePick}/>
              <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-1.5 py-1.5 backdrop-blur-xl shadow-lg shadow-black/20">
                <button type="button" onClick={()=>mediaInputRef.current?.click()} disabled={uploadingMedia} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-mist transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 disabled:opacity-30" aria-label="Send image">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.6"/><circle cx="8" cy="10" r="2" fill="currentColor"/><path d="M22 16l-5-5-5 5M17 11l-3 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {recording ? (
                  <>
                    <div className="flex flex-1 items-center gap-3 px-3">
                      <span className="relative flex h-3 w-3 shrink-0"><span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75"/><span className="relative h-3 w-3 rounded-full bg-red-500"/></span>
                      <span className="flex-1 text-sm font-medium tracking-wide text-red-400">Recording {formatDuration(recordingSeconds)}</span>
                      <button type="button" onClick={cancelRecording} className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-mist transition hover:bg-white/10 hover:text-white">Cancel</button>
                    </div>
                    <button type="button" onClick={stopAndSendRecording} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-light text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 hover:scale-105 active:scale-95" aria-label="Send voice note">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <input value={input} onChange={handleInputChange} onFocus={()=>{setTimeout(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"})},300)}} placeholder={uploadingMedia?"Sending…":replyingTo?"Reply…":"Message"} disabled={uploadingMedia} className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-[15px] text-white placeholder:text-white/25 outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none disabled:opacity-40"/>
                    {input.trim() ? (
                      <button type="submit" disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-light text-white shadow-lg shadow-violet/30 transition-all hover:shadow-violet/50 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100" aria-label="Send message">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    ) : (
                      <button type="button" onClick={startRecording} disabled={uploadingMedia} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-mist transition-all hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 disabled:opacity-30" aria-label="Record voice note">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
