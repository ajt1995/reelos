import { useEffect, useRef, useState } from "react";
import { activeExperienceProfile, useExperienceStore } from "@/experience/experience-state";
import { createPreparationController, preparedFileUrl, preparationIsActive, type PreparationJob, type PreparationState } from "@/lib/preparation-client";
import { createPreparedViewingController } from "@/lib/prepared-viewing-client";

const controls = "min-h-12 min-w-12 rounded-xl border border-white/15 px-4 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40";
const emptyState: PreparationState = { snapshot: null, loading: false, mutating: false, error: null };

export function PreparationPanel({ titles }: { titles: { id: string; title: string }[] }) {
  const profileId = activeExperienceProfile(useExperienceStore()).id;
  const activeProfile = useRef(profileId);
  activeProfile.current = profileId;
  const controllerRef = useRef<ReturnType<typeof createPreparationController> | null>(null);
  const [stored, setStored] = useState({ profileId: "", state: emptyState });
  const [titleId, setTitleId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [playing, setPlaying] = useState<{ profileId: string; jobId: string } | null>(null);
  const [opening, setOpening] = useState<{ profileId: string; jobId: string } | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewingRef = useRef<{ profileId: string; controller: ReturnType<typeof createPreparedViewingController> } | null>(null);

  function closeViewing(clearError = true) {
    const viewing = viewingRef.current;
    if (viewing?.profileId === profileId) {
      viewingRef.current = null;
      videoRef.current?.pause();
      void viewing.controller.dispose();
    }
    setPlaying(null); setOpening(null);
    if (clearError) setPlaybackError(null);
  }

  function openViewing(job: PreparationJob) {
    closeViewing();
    setOpening({ profileId, jobId: job.id });
    let controller: ReturnType<typeof createPreparedViewingController>;
    try {
      controller = createPreparedViewingController({
        profileId, jobId: job.id,
        isCurrent: () => viewingRef.current?.controller === controller && activeProfile.current === profileId &&
          activeExperienceProfile(useExperienceStore.getState()).id === profileId,
        onChange: (next) => {
          if (viewingRef.current?.controller !== controller || activeProfile.current !== profileId) return;
          if (next.status === "active") {
            setOpening(null);
            setPlaying((current) => current?.profileId === profileId && current.jobId === job.id ? current : { profileId, jobId: job.id });
          } else if (next.status === "error" || next.status === "stopped") {
            videoRef.current?.pause();
            setOpening(null); setPlaying(null);
            if (next.error) setPlaybackError(next.error);
          }
        },
      });
    } catch {
      setOpening(null);
      setPlaybackError("Prepared playback could not be started. Choose Play prepared copy to try again.");
      return;
    }
    viewingRef.current = { profileId, controller };
    void controller.start();
  }

  useEffect(() => () => {
    const viewing = viewingRef.current;
    if (viewing?.profileId !== profileId) return;
    viewingRef.current = null;
    videoRef.current?.pause();
    void viewing.controller.dispose();
  }, [profileId]);

  useEffect(() => {
    setTitleId(""); setRecipeId(""); setPlaying(null); setOpening(null); setPlaybackError(null);
    if (!profileId) {
      setStored({ profileId, state: { ...emptyState, error: "Choose your profile to view prepared media." } });
      return;
    }
    const controller = createPreparationController({
      expectedProfileId: profileId,
      isCurrent: () => activeProfile.current === profileId && activeExperienceProfile(useExperienceStore.getState()).id === profileId,
      onChange: (state) => setStored({ profileId, state }),
    });
    controllerRef.current = controller;
    const onVisibility = () => controller.setVisible(document.visibilityState === "visible");
    onVisibility();
    if (document.visibilityState === "visible") void controller.refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [profileId]);

  const state = stored.profileId === profileId ? stored.state : { ...emptyState, loading: Boolean(profileId) };
  const snapshot = state.snapshot;
  const busy = state.loading || state.mutating;
  const chosenTitle = titles.find((title) => title.id === titleId)?.id || titles[0]?.id || "";
  const chosenRecipe = snapshot?.recipes.find((recipe) => recipe.id === recipeId)?.id || snapshot?.recipes[0]?.id || "";
  const playingJob = playing?.profileId === profileId ? snapshot?.jobs.find((job) => job.id === playing.jobId && job.status === "ready") : null;
  const playingUrl = playingJob ? preparedFileUrl(playingJob, profileId) : null;
  const openingHere = opening?.profileId === profileId ? opening : null;
  useEffect(() => {
    if (playing?.profileId === profileId && !playingJob) {
      closeViewing(false);
      setPlaybackError("This prepared copy is no longer verified. Refresh its status before playing again.");
    }
  }, [playing, playingJob, profileId]);

  return (
    <section aria-label="Prepared media" className="space-y-5 rounded-[1.55rem] bg-white/[.035] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-2xl tracking-tight">Prepared media</h2><p className="mt-1 text-sm text-white/55">Prepare a copy of an eligible original in this home. Your original stays unchanged.</p></div>
        <button type="button" className={controls} disabled={busy || !profileId} onClick={() => void controllerRef.current?.refresh()}>Refresh preparation</button>
      </div>
      {state.error ? <div role="alert" className="space-y-3 text-sm"><p>{state.error}</p><button type="button" className={controls} disabled={busy || !profileId} onClick={() => void controllerRef.current?.refresh()}>Retry loading preparation</button></div> : null}
      {state.loading && !snapshot ? <p role="status" className="text-sm text-white/55">Checking prepared media…</p> : null}
      {snapshot?.canManage ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm"><span className="block">Original title</span><select aria-label="Original title" className={`${controls} w-full bg-zinc-950`} value={chosenTitle} disabled={busy || !titles.length} onChange={(event) => setTitleId(event.target.value)}>{titles.length ? titles.map((title) => <option key={title.id} value={title.id}>{title.title}</option>) : <option value="">No eligible originals available</option>}</select></label>
            <label className="space-y-2 text-sm"><span className="block">Prepared copy</span><select aria-label="Prepared copy" className={`${controls} w-full bg-zinc-950`} value={chosenRecipe} disabled={busy || !snapshot.recipes.length} onChange={(event) => setRecipeId(event.target.value)}>{snapshot.recipes.length ? snapshot.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>) : <option value="">No preparation recipes available</option>}</select></label>
          </div>
          <button type="button" className={`${controls} bg-white/10`} disabled={busy || !chosenTitle || !chosenRecipe} onClick={() => void controllerRef.current?.prepare(chosenTitle, chosenRecipe)}>Prepare media</button>
          {state.mutating ? <p role="status" className="text-sm text-white/55">Confirming your preparation request…</p> : null}
        </div>
      ) : snapshot ? <p className="text-sm text-white/55">Only the home owner can manage preparation.</p> : null}
      {snapshot && snapshot.jobs.length === 0 ? <p className="text-sm text-white/45">No prepared copies have been reported for this profile.</p> : null}
      <div className="space-y-3">
        {snapshot?.jobs.map((job) => (
          <article key={job.id} className="space-y-3 rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{job.title}</h3><span className="text-sm capitalize text-white/60">{job.status}</span></div>
            <p className="text-xs text-white/45">{snapshot.recipes.find((recipe) => recipe.id === job.recipe)?.label || job.recipe}</p>
            <p className="text-sm text-white/60">{job.message}</p>
            {job.progress !== null ? <div className="flex items-center gap-3"><progress aria-label={`Preparation progress for ${job.title}`} max={1} value={job.progress} className="h-2 w-full accent-current" /><span className="text-xs tabular-nums text-white/55">{Math.floor(job.progress * 100)}%</span></div> : null}
            <div className="flex flex-wrap gap-2">
              {snapshot.canManage && preparationIsActive(job) ? <button type="button" className={controls} disabled={busy} onClick={() => void controllerRef.current?.cancel(job)}>Cancel preparation</button> : null}
              {snapshot.canManage && job.canRetry && ["deferred", "failed", "cancelled", "interrupted"].includes(job.status) ? <button type="button" className={controls} disabled={busy} onClick={() => void controllerRef.current?.retry(job)}>Retry preparation</button> : null}
              {job.status === "ready" ? <button type="button" className={controls} disabled={Boolean(openingHere)} onClick={() => openViewing(job)}>Play prepared copy</button> : null}
            </div>
          </article>
        ))}
      </div>
      {openingHere ? <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">Opening prepared playback…</p><button type="button" className={controls} onClick={() => closeViewing()}>Close prepared playback</button></div> : null}
      {playingJob && playingUrl ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3"><p className="text-sm">{playingJob.title}</p><button type="button" className={controls} onClick={() => closeViewing()}>Close prepared playback</button></div>
          <video ref={videoRef} key={playingUrl} src={playingUrl} controls playsInline autoPlay preload="metadata" aria-label={`Prepared copy of ${playingJob.title}`} className="max-h-[65vh] w-full rounded-xl bg-black" onError={() => { closeViewing(false); setPlaybackError("This prepared copy could not be played. Refresh its status and try again."); }} />
        </div>
      ) : null}
      {playbackError ? <p role="alert" className="text-sm">{playbackError}</p> : null}
    </section>
  );
}
