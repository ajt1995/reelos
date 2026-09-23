import { useCallback, useEffect, useRef, useState } from "react";
import type { CuratorVote } from "@/lib/discover-curator";
import type { Title } from "@/lib/types";
import { useExperienceStore } from "@/experience/experience-state";
import { loadPrivateCurator, savePrivateCuratorVote, type PrivateCuratorSnapshot } from "@/lib/private-curator-client";
// Delegates private preference persistence to /api/curator
import { showToast } from "@/lib/toast";

interface CuratorSession {
  localProfileId: string;
  confirmedProfileId: string | null;
  controller: AbortController;
  saving: boolean;
}

interface CuratorState {
  owner: string;
  snapshot: PrivateCuratorSnapshot | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export function useCurator() {
  const activeProfileId = useExperienceStore((state) => state.activeProfileId);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<CuratorState>({ owner: "", snapshot: null, loading: false, saving: false, error: null });
  const sessionRef = useRef<CuratorSession | null>(null);
  const isCurrent = useCallback((session: CuratorSession) => (
    sessionRef.current === session && !session.controller.signal.aborted &&
    useExperienceStore.getState().activeProfileId === session.localProfileId
  ), []);

  useEffect(() => {
    const session: CuratorSession = {
      localProfileId: activeProfileId, confirmedProfileId: null,
      controller: new AbortController(), saving: false,
    };
    sessionRef.current = session;
    setState({ owner: activeProfileId, snapshot: null, loading: Boolean(activeProfileId), saving: false, error: null });
    if (activeProfileId) {
      void loadPrivateCurator(activeProfileId, session.controller.signal)
        .then((snapshot) => {
          if (!isCurrent(session)) return;
          // Only a validated GET can establish the identity sent with a later vote.
          session.confirmedProfileId = snapshot.profileId;
          setState({ owner: activeProfileId, snapshot, loading: false, saving: false, error: null });
        })
        .catch(() => {
          if (!isCurrent(session)) return;
          const error = "Your taste could not be loaded. Please retry.";
          setState({ owner: activeProfileId, snapshot: null, loading: false, saving: false, error });
          showToast(error, "error");
        });
    }
    return () => {
      session.controller.abort();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [activeProfileId, reload, isCurrent]);

  const voteTitle = useCallback(
    async (title: Title, vote: CuratorVote): Promise<boolean> => {
      const session = sessionRef.current;
      if (!session || !isCurrent(session) || !session.confirmedProfileId) {
        showToast("Your profile's taste is not ready. Reload it and try again.", "error");
        return false;
      }
      if (session.saving) {
        showToast("Your previous choice is still saving. Please try again in a moment.", "info");
        return false;
      }
      session.saving = true;
      setState((current) => ({ ...current, saving: true, error: null }));
      try {
        const snapshot = await savePrivateCuratorVote({
          id: title.id, vote, expectedProfileId: session.confirmedProfileId,
        }, session.controller.signal);
        if (!isCurrent(session)) return false;
        setState({ owner: session.localProfileId, snapshot, loading: false, saving: false, error: null });
        return true;
      } catch {
        if (isCurrent(session)) {
          const error = "Your taste was not saved. Please try again.";
          setState((current) => ({ ...current, saving: false, error }));
          showToast(error, "error");
        }
        return false;
      } finally {
        session.saving = false;
      }
    },
    [isCurrent],
  );

  const retry = useCallback(() => {
    sessionRef.current?.controller.abort();
    sessionRef.current = null;
    setState({ owner: activeProfileId, snapshot: null, loading: Boolean(activeProfileId), saving: false, error: null });
    setReload((current) => current + 1);
  }, [activeProfileId]);
  // Never paint the previous profile's data while a profile-change effect is pending.
  const current = state.owner === activeProfileId ? state : null;
  return {
    hiddenIds: current?.snapshot?.hidden ?? [], likedIds: current?.snapshot?.liked ?? [], voteTitle,
    loading: current?.loading ?? Boolean(activeProfileId), saving: current?.saving ?? false,
    error: current?.error ?? null, retry,
  };
}
