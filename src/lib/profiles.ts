import { useCallback, useEffect, useState } from "react";

export const GOOGLE_TV_COPY =
  "Google TV has no supported taste or watch-history API. ReelOS will not Sign in with Google and will not scrape Google. Use thumbs on Discover, or optional free Trakt.";

export const TRAKT_FREE_COPY =
  "Trakt is free. VIP is optional paid extras we do not need. Local like/dislike works with Trakt disconnected. Connect only if you want ratings synced.";

export type ProfileKind = "adult" | "kids";

export type HouseProfile = {
  id: string;
  name: string;
  role: "admin" | "member";
  kind: ProfileKind;
  parental: { hideAdult: boolean; lockRequest: boolean; lockSettings: boolean };
};

export type ProfileState = {
  picker: boolean;
  activeId: string;
  profile: HouseProfile | null;
  profiles: HouseProfile[];
  votes: Record<string, "up" | "down">;
  continueWatching: Record<string, number>;
  trakt: { connected: boolean; username: string; pending: { userCode: string; verificationUrl: string } | null };
  googleTv: { supported: boolean; copy: string };
  traktCopy: string;
  traktConfigured: boolean;
};

const empty: ProfileState = {
  picker: false,
  activeId: "p-admin",
  profile: null,
  profiles: [],
  votes: {},
  continueWatching: {},
  trakt: { connected: false, username: "", pending: null },
  googleTv: { supported: false, copy: GOOGLE_TV_COPY },
  traktCopy: TRAKT_FREE_COPY,
  traktConfigured: false,
};

export function isKidsProfile(p?: HouseProfile | null) {
  return Boolean(p?.kind === "kids" || p?.parental?.lockRequest || p?.parental?.lockSettings);
}

export function useHouseholdProfile() {
  const [state, setState] = useState<ProfileState>(empty);

  const refresh = useCallback(() => {
    void fetch("/api/profiles", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setState({
          picker: Boolean(j.picker),
          activeId: j.activeId || j.profile?.id || "p-admin",
          profile: j.profile || null,
          profiles: Array.isArray(j.profiles) ? j.profiles : [],
          votes: j.curator?.votes || {},
          continueWatching: j.curator?.continueWatching || {},
          trakt: {
            connected: Boolean(j.curator?.trakt?.connected),
            username: j.curator?.trakt?.username || "",
            pending: j.curator?.trakt?.pending || j.trakt?.pending || null,
          },
          googleTv: j.googleTv || { supported: false, copy: GOOGLE_TV_COPY },
          traktCopy: j.trakt?.copy || TRAKT_FREE_COPY,
          traktConfigured: Boolean(j.trakt?.app?.configured),
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const select = useCallback(
    async (id: string) => {
      await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", id }),
      });
      refresh();
    },
    [refresh],
  );

  const vote = useCallback(
    async (titleId: string, next: "up" | "down") => {
      const res = await fetch("/api/curator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, vote: next }),
      });
      const j = (await res.json().catch(() => null)) as { votes?: Record<string, "up" | "down"> } | null;
      if (j?.votes) setState((s) => ({ ...s, votes: j.votes || {} }));
      else refresh();
    },
    [refresh],
  );

  return { ...state, refresh, select, vote, kids: isKidsProfile(state.profile) };
}
