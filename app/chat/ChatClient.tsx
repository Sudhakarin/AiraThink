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
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ConversationRow = {
  id: string;
  is_group: boolean;
  name: string | null;
  otherProfile: Profile | null;
  lastMessage: string;
  lastAt: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white"
      style={{ width: size, height: size, background: color }}
    >
      {initials(name)}
    </div>
  );
}

export default function ChatClient({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);

    const { data: participantRows } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", profile.id);

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
      .neq("user_id", profile.id);

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
  }, [profile.id, supabase]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
          setMessages((prev) => [...prev, payload.new as Message]);
          loadConversations();
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
    const active = conversations.find((c) => c.id === activeId);
    if (active?.otherProfile) {
      setProfilesById((prev) => ({ ...prev, [active.otherProfile!.id]: active.otherProfile! }));
    }
  }, [activeId, conversations]);

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
      .neq("id", profile.id)
      .limit(8);
    setSearchResults(data ?? []);
  }

    async function startConversation(other: Profile) {
    alert("Button tapped, starting...");

    const { data: mine, error: mineError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", profile.id);

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
        setShowSearch(false);
        setSearch("");
        setActiveId(theirs[0].conversation_id);
        return;
      }
    }

    const { data: convo, error } = await supabase
      .from("conversations")
      .insert({ is_group: false, created_by: profile.id })
      .select()
      .single();

    if (error || !convo) {
      alert("Error creating conversation: " + (error?.message ?? "unknown"));
      return;
    }

    const { error: partError } = await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: profile.id },
      { conversation_id: convo.id, user_id: other.id },
    ]);

    if (partError) {
      alert("Error adding participants: " + partError.message);
      return;
    }

    setShowSearch(false);
    setSearch("");
    await loadConversations();
    setActiveId(convo.id);
  }


  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || !activeId) return;
    setInput("");
    await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: profile.id,
      content,
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-screen bg-ink-900 text-white">
      <aside className="flex w-full max-w-xs flex-col border-r border-white/5 bg-ink-800/60">
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-lg font-bold">
            Think<span className="text-gradient">chat</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-mist transition hover:text-white"
          >
            Log out
          </button>
        </div>

        <div className="px-4">
          <button
            onClick={() => setShowSearch((s) => !s)}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-ink-700/60 px-4 py-2.5 text-sm text-mist transition hover:border-violet/40 hover:text-white"
          >
            <span className="text-lg leading-none">+</span> New conversation
          </button>

          {showSearch && (
            <div className="glass animate-fadeUp mb-3 rounded-xl p-3">
              <input
                autoFocus
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by username…"
                className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder:text-mist/50 focus:border-violet focus:outline-none"
              />
              <div className="mt-2 max-h-48 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => startConversation(r)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/5"
                  >
                    <Avatar name={r.display_name} color={r.avatar_color} size={28} />
                    <span>
                      {r.display_name} <span className="text-mist">@{r.username}</span>
                    </span>
                  </button>
                ))}
                {search.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="px-2 py-2 text-xs text-mist">No users found.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loadingConvos && <p className="px-3 py-2 text-xs text-mist">Loading…</p>}
          {!loadingConvos && conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-mist">
              No conversations yet. Start one above.
            </p>
          )}
          {conversations.map((c) => {
            const name = c.is_group ? c.name ?? "Group" : c.otherProfile?.display_name ?? "Unknown";
            const color = c.otherProfile?.avatar_color ?? "#7C5CFF";
            return (
              <button
                key={c.id}
                                onClick={() => {
                  setActiveId(c.id);
                  setShowSearch(false);
                }}

                className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  activeId === c.id ? "bg-violet/15" : "hover:bg-white/5"
                }`}
              >
                <Avatar name={name} color={color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-mist">{c.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 px-4 py-4">
          <Avatar name={profile.display_name} color={profile.avatar_color} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.display_name}</p>
            <p className="truncate text-xs text-mist">@{profile.username}</p>
          </div>
        </div>
      </aside>

      <section className="relative flex flex-1 flex-col">
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
              Or start a new one from the sidebar — your messages sync in real time.
            </p>
          </div>
        ) : (
          <>
            <header className="glass relative z-10 flex items-center gap-3 border-b border-white/5 px-6 py-4">
              <Avatar
                name={active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"}
                color={active.otherProfile?.avatar_color ?? "#7C5CFF"}
              />
              <div>
                <p className="text-sm font-semibold">
                  {active.is_group ? active.name ?? "Group" : active.otherProfile?.display_name ?? "Unknown"}
                </p>
                {!active.is_group && (
                  <p className="text-xs text-mist">@{active.otherProfile?.username}</p>
                )}
              </div>
            </header>

            <div ref={scrollRef} className="relative z-10 flex-1 space-y-3 overflow-y-auto px-6 py-6">
              {messages.map((m) => {
                const mine = m.sender_id === profile.id;
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
                      <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-mist"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                disabled={!input.trim()}
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
