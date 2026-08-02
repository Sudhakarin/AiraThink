"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  status: string;
  last_seen?: string;
  avatar_url?: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
};

type ConversationRow = {
  id: string;
  is_group: boolean;
  name: string | null;
  otherProfile: Profile | null;
  lastMessage: string;
  lastAt: string;
};

type MobileTab = "home" | "chats" | "search" | "profile";

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

function Ticks({ read }: { read: boolean }) {
  return read ? (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="inline-block align-middle">
      <path d="M1 5l3 3 5-7" stroke="#22D3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5l3 3 6-8" stroke="#22D3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="inline-block align-middle">
      <path d="M1 5l3 3 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TabIcon({ tab }: { tab: MobileTab }) {
  if (tab === "home") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 11l8-7 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tab === "chats") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function ChatClient({ profile: initialProfile }: { profile: Profile }) {
  const supabase = createClient();
  const router = useRouter();

  const [myProfile, setMyProfile] = useState<Profile>(initialProfile);
  const [myEmail, setMyEmail] = useState<string>("");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [sending, setSending] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [otherProfileFresh, setOtherProfileFresh] = useState<Profile | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("home");
  const [nameDraft, setNameDraft] = useState(initialProfile.display_name);
  const [uploading, setUploading] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = conversations.find((c) => c.id === activeId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setMyEmail(data.user.email);
    });
  }, [supabase]);

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
      .select("conversation_id, content, created_at")
      .in("conversation_id", convoIds)
      .order("created_at", { ascending: false });

    const rows = (convos ?? []).map((c) => {
      const other = (otherParticipants ?? []).find((p) => p.conversation_id === c.id);
      const last = (lastMessages ?? []).find((m) => m.conversation_id === c.id);
      return {
        id: c.id,
        is_group: c.is_group,
        name: c.name,
        otherProfile: other?.profiles ?? null,
        lastMessage: last?.content ?? "Say hello 👋",
        lastAt: last?.created_at ?? "",
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

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages(data ?? []);
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
              (m) => !(m.id.startsWith("temp-") && m.content === incoming.content && m.sender_id === incoming.sender_id)
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

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeId, supabase, loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
      .then(() => {});
  }, [messages, activeId, myProfile.id, supabase]);

  useEffect(() => {
    setShowContactInfo(false);
  }, [activeId]);

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

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: activeId,
      sender_id: myProfile.id,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: myProfile.id,
      content,
    });
    loadConversations();
    setSending(false);
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

  const otherIsOnline = active?.otherProfile ? onlineIds.has(active.otherProfile.id) : false;
  const otherDisplayProfile = otherProfileFresh ?? active?.otherProfile ?? null;

  return (
    <div className="flex h-screen bg-ink-900 text-white">
      <aside
        className={`${
          activeId ? "hidden md:flex" : "flex"
        } w-full max-w-xs flex-col border-r border-white/5 bg-ink-800/60`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-lg font-bold">
            Aira<span className="text-gradient">Think</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-mist transition hover:text-white"
          >
            Log out
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {mobileTab === "home" && (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
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
              <h2 className="font-display text-2xl font-bold text-white">
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
                  className="mt-3 text-xs font-medium text-mist transition hover:text-white"
                >
                  Or go to your chats →
                </button>
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
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      activeId === c.id ? "bg-violet/15" : "hover:bg-white/5"
                    }`}
                  >
                    <Avatar name={name} color={color} online={online} avatarUrl={c.otherProfile?.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center truncate text-sm font-medium">
                        <span className="truncate">{name}</span>
                        {isVerified(c.otherProfile?.username) && <VerifiedBadge />}
                      </p>
                      <p className="truncate text-xs text-mist">{c.lastMessage}</p>
                    </div>
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
                className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
              />
              <div className="mt-3">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => startConversation(r)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-white/5"
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
              <h2 className="mb-6 text-center font-display text-lg font-bold text-white">Edit Profile</h2>

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

              <div className="glass mt-6 divide-y divide-white/5 overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Full name</span>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="w-40 bg-transparent text-right text-sm text-white outline-none"
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Email</span>
                  <span className="truncate text-sm text-white">{myEmail || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-xs font-medium text-mist">Username</span>
                  <span className="inline-flex items-center text-sm text-white">
                    @{myProfile.username}
                    {isVerified(myProfile.username) && <VerifiedBadge />}
                  </span>
                </div>
              </div>

              <button
                onClick={saveDisplayName}
                disabled={!nameDraft.trim() || nameDraft.trim() === myProfile.display_name}
                className="mt-6 w-full rounded-full bg-gradient-to-r from-violet to-violet-light py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 disabled:opacity-40"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 border-t border-white/5 bg-ink-800/80">
          {(["home", "chats", "search", "profile"] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium capitalize transition ${
                mobileTab === tab ? "text-violet-light" : "text-mist"
              }`}
            >
              <TabIcon tab={tab} />
              {tab}
            </button>
          ))}
        </div>
      </aside>

      <section className={`${activeId ? "flex" : "hidden md:flex"} relative flex-1 flex-col`}>
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
            <header className="glass flex items-center gap-3 border-b border-white/5 px-4 py-4">
              <button
                onClick={() => setShowContactInfo(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-mist transition hover:bg-white/5 hover:text-white"
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
              <p className="mt-5 flex items-center font-display text-xl font-bold text-white">
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
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <header className="glass relative z-10 flex items-center gap-3 border-b border-white/5 px-4 py-4 md:px-6">
              <button
                onClick={() => setActiveId(null)}
                className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mist transition hover:bg-white/5 hover:text-white md:hidden"
                aria-label="Back to conversations"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => setShowContactInfo(true)}
                className="flex flex-1 items-center gap-3 rounded-lg py-1 text-left transition hover:bg-white/5"
              >
                <Avatar
                  name={active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"}
                  color={active.otherProfile?.avatar_color ?? "#7C5CFF"}
                  online={otherIsOnline}
                  avatarUrl={active.otherProfile?.avatar_url}
                />
                <div>
                  <p className="flex items-center text-sm font-semibold">
                    <span>{active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"}</span>
                    {isVerified(active.otherProfile?.username) && <VerifiedBadge />}
                  </p>
                  {!active.is_group && (
                    <p className="text-xs text-mist">
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
            </header>

            <div ref={scrollRef} className="relative z-10 flex-1 space-y-3 overflow-y-auto px-6 py-6">
              {messages.map((m) => {
                const mine = m.sender_id === myProfile.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                        mine
                          ? "rounded-br-sm bg-gradient-to-br from-violet to-violet-dark text-white"
                          : "glass rounded-bl-sm text-white"
                      }`}
                    >
                      <p>{m.content}</p>
                      <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/60" : "text-mist"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {mine && <Ticks read={!!m.read_at} />}
                      </p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p className="pt-10 text-center text-sm text-mist">No messages yet — say hello 👋</p>
              )}
            </div>

            <form onSubmit={sendMessage} className="relative z-10 flex items-center gap-3 border-t border-white/5 px-6 py-4">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-white/10 bg-ink-800 px-5 py-3 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="rounded-full bg-gradient-to-r from-violet to-violet-light px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet/30 transition hover:shadow-violet/50 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
