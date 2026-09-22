import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clapperboard,
  Clock,
  Gamepad2,
  Maximize2,
  Minimize2,
  Flame,
  Play,
  Tv,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Poster } from "@/components/poster";
import { ProfileSwitcher, ResidentAvatar } from "@/components/profile-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { GuestQrPopover } from "@/components/guest-qr-popover";
import { StandbyAmbiance } from "@/components/standby-ambiance";
import { showToast } from "@/lib/toast";
import { jellyfinWatchHref } from "@/lib/jellyfin-watch";
import { homeShelfRows } from "@/lib/shelf";
import { useReelStore } from "@/lib/store";
import type { Title } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TvView() {
  const navigate = useNavigate();
  const shelf = useReelStore((s) => s.shelf);
  const hydrateShelf = useReelStore((s) => s.hydrateShelf);
  const watchProgress = useReelStore((s) => s.watchProgress);
  const houseName = useReelStore((s) => s.houseName);
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const ipv4 = useReelStore((s) => s.ipv4);
  const tailscaleIp = useReelStore((s) => s.tailscaleIp);
  const watchDoor = useReelStore((s) => s.watch);
  const jfLive = useReelStore((s) => s.jellyfinHop?.state === "green");

  const [timeStr, setTimeStr] = useState("");
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTvModal, setActiveTvModal] = useState<Title | null>(null);
  const [modalActionIndex, setModalActionIndex] = useState(0);
  const [isIdleAmbiance, setIsIdleAmbiance] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active resident profile
  const activeResident =
    residents.find((r) => r.id === activeResidentId) ??
    residents[0] ?? { id: "res-primary", name: "Living Room", avatar: "clapperboard" };

  // 10-Foot Focus Grid: row 0 = Hero, 1 = Continue Watching, 2 = Recently Added, 3 = Pick Tonight
  const [focusedRow, setFocusedRow] = useState(0);
  const [focusedCol, setFocusedCol] = useState(0);

  // Focus elements references
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  const isKidsProfile = Boolean(activeResident?.isKids);
  const hideKids = Boolean(activeResident?.hideKidsContent);
  const kidsTitleIds = useReelStore((s) => s.kidsTitleIds);
  const residentWatchlist = activeResident?.watchlist || [];

  const filteredShelf = useMemo(() => {
    let list = shelf;
    if (activeResident?.id !== "res-primary" && activeResident?.assignedTitleIds && activeResident.assignedTitleIds.length > 0) {
      const allowed = new Set(activeResident.assignedTitleIds);
      const matches = list.filter((t) => {
        if (allowed.has(t.id)) return true;
        if (t.jellyfinId && allowed.has(t.jellyfinId)) return true;
        if (Array.isArray(t.ids) && t.ids.some((i) => allowed.has(i))) return true;
        return false;
      });
      if (matches.length > 0) {
        list = matches;
      }
    }
    if (isKidsProfile) {
      return list.filter((t) => {
        const id = String(t.id || t.jellyfinId || "");
        if (kidsTitleIds.includes(id)) return true;
        const genres = (t.genres || []).map((g) => g.toLowerCase());
        return genres.includes("animation") || genres.includes("family") || genres.includes("children");
      });
    }
    if (hideKids) {
      const watchlistSet = new Set(residentWatchlist);
      return list.filter((t) => {
        const id = String(t.id || t.jellyfinId || "");
        if (watchlistSet.has(id)) return true;
        if (kidsTitleIds.includes(id)) return false;
        const genres = (t.genres || []).map((g) => g.toLowerCase());
        const isKidGenre = genres.includes("animation") || genres.includes("family") || genres.includes("children");
        return !isKidGenre;
      });
    }
    return list;
  }, [shelf, isKidsProfile, hideKids, kidsTitleIds, residentWatchlist, activeResident?.assignedTitleIds, activeResident?.id]);

  // Shelf data
  const boxShelf = useMemo(() => homeShelfRows(filteredShelf), [filteredShelf]);

  const continueWatching = useMemo(() => {
    return Object.entries(watchProgress)
      .filter(([, p]) => p > 0.03 && p < 0.96)
      .map(([id, p]) => {
        const t = shelf.find((x) => x.id === id || x.jellyfinId === id);
        return t ? { title: t, progress: p } : null;
      })
      .filter((x): x is { title: Title; progress: number } => Boolean(x));
  }, [shelf, watchProgress]);

  const recentlyAdded = useMemo(() => {
    return [...boxShelf]
      .sort((a, b) => {
        if (a.dateAdded && b.dateAdded) {
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        }
        return 0;
      })
      .slice(0, 12);
  }, [boxShelf]);

  const pickTonight = useMemo(() => {
    return boxShelf.slice(0, 12);
  }, [boxShelf]);

  // Featured title for hero
  const featuredTitle =
    continueWatching[0]?.title ??
    recentlyAdded[0] ??
    boxShelf[0] ?? {
      id: "demo",
      title: "ReelOS Cinema Lounge",
      overview: "Experience seamless, zero-buffer 4K HDR entertainment right from your sofa.",
      year: "2026",
      maxQuality: "4k",
    };

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      );
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    hydrateShelf({ limit: 36, force: true });
  }, [hydrateShelf]);

  // Section 34: Thoughtful Standby Ambiance (3 min idle auto-engage)
  useEffect(() => {
    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsIdleAmbiance(true);
      }, 3 * 60 * 1000);
    };

    resetIdleTimer();
    const onActivity = () => {
      resetIdleTimer();
    };

    window.addEventListener("keydown", onActivity);
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("pointerdown", onActivity);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
    };
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Active rendered rows: 0 = Hero, 1 = ContinueWatching, 2 = RecentlyAdded, 3 = PickTonight
  const activeRows = useMemo(() => {
    const rows = [0];
    if (continueWatching.length > 0) rows.push(1);
    if (recentlyAdded.length > 0) rows.push(2);
    if (pickTonight.length > 0) rows.push(3);
    return rows;
  }, [continueWatching.length, recentlyAdded.length, pickTonight.length]);

  const getRowItemCount = (rowIndex: number) => {
    if (rowIndex === 0) return 1;
    if (rowIndex === 1) return continueWatching.length;
    if (rowIndex === 2) return recentlyAdded.length;
    if (rowIndex === 3) return pickTonight.length;
    return 1;
  };

  // Double-tap Back button guard for 10-foot TV mode
  const lastBackPressRef = useRef(0);

  const handleBack = () => {
    if (activeTvModal) {
      setActiveTvModal(null);
      return;
    }
    const now = Date.now();
    if (focusedRow > 0) {
      setFocusedRow(0);
      setFocusedCol(0);
    } else {
      if (now - lastBackPressRef.current < 2000) {
        void navigate({ to: "/" });
      } else {
        lastBackPressRef.current = now;
        showToast("Press Back again to exit TV Couch Mode", "info");
      }
    }
  };

  const openModalForTitle = (t: Title) => {
    setActiveTvModal(t);
    setModalActionIndex(0);
  };

  // Handle selection (Enter / Gamepad A)
  const handleSelect = (row: number, col: number) => {
    if (activeTvModal) {
      if (modalActionIndex === 0) {
        void navigate({ to: "/play/$id", params: { id: activeTvModal.id } });
      } else if (modalActionIndex === 1) {
        void navigate({ to: "/title/$id", params: { id: activeTvModal.id } });
      } else {
        setActiveTvModal(null);
      }
      return;
    }
    if (row === -1) {
      if (col === 0) {
        void navigate({ to: "/" });
      } else if (col === 1) {
        toggleFullscreen();
      }
      return;
    }
    if (row === 0) {
      if (featuredTitle.id && featuredTitle.id !== "demo") {
        openModalForTitle(featuredTitle);
      }
      return;
    }
    if (row === 1 && continueWatching[col]) {
      openModalForTitle(continueWatching[col].title);
      return;
    }
    if (row === 2 && recentlyAdded[col]) {
      openModalForTitle(recentlyAdded[col]);
      return;
    }
    if (row === 3 && pickTonight[col]) {
      openModalForTitle(pickTonight[col]);
      return;
    }
  };

  // Removed duplicate handleBack

  // Spatial Keyboard Navigation Engine
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTvModal) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setModalActionIndex((i) => Math.max(0, i - 1));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setModalActionIndex((i) => Math.min(2, i + 1));
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect(focusedRow, focusedCol);
        } else if (e.key === "Escape" || e.key === "Backspace") {
          e.preventDefault();
          handleBack();
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedRow((r) => {
          if (r === 0) {
            setFocusedCol(0);
            return -1; // Navigate up to header row
          }
          if (r === -1) return -1;
          const currentIndex = activeRows.indexOf(r);
          if (currentIndex <= 0) {
            setFocusedCol(0);
            return -1;
          }
          const prevRow = activeRows[currentIndex - 1] ?? 0;
          setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(prevRow) - 1), c));
          return prevRow;
        });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedRow((r) => {
          if (r === -1) {
            setFocusedCol(0);
            return 0; // Return to hero
          }
          const currentIndex = activeRows.indexOf(r);
          const nextActiveIndex = currentIndex >= 0 && currentIndex < activeRows.length - 1 ? currentIndex + 1 : currentIndex;
          const nextRow = activeRows[nextActiveIndex] ?? r;
          setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(nextRow) - 1), c));
          return nextRow;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedCol((c) => Math.max(0, c - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const max = focusedRow === -1 ? 1 : Math.max(0, getRowItemCount(focusedRow) - 1);
        setFocusedCol((c) => Math.min(max, c + 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(focusedRow, focusedCol);
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        handleBack();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedRow, focusedCol, activeRows, activeTvModal, modalActionIndex, navigate]);

  // Gamepad Controller Engine (Zero-mouse D-pad / Joystick)
  useEffect(() => {
    let animId: number;
    let lastButtonTime = 0;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let found = false;

      for (const gp of gamepads) {
        if (!gp) continue;
        found = true;

        const now = performance.now();
        if (now - lastButtonTime > 180) {
          // D-Pad or Left Stick
          const up = gp.buttons[12]?.pressed || (gp.axes[1] && gp.axes[1] < -0.5);
          const down = gp.buttons[13]?.pressed || (gp.axes[1] && gp.axes[1] > 0.5);
          const left = gp.buttons[14]?.pressed || (gp.axes[0] && gp.axes[0] < -0.5);
          const right = gp.buttons[15]?.pressed || (gp.axes[0] && gp.axes[0] > 0.5);

          // Buttons: 0 = A (Select), 1 = B (Back)
          const btnA = gp.buttons[0]?.pressed;
          const btnB = gp.buttons[1]?.pressed;

          if (activeTvModal) {
            if (left) {
              setModalActionIndex((i) => Math.max(0, i - 1));
              lastButtonTime = now;
            } else if (right) {
              setModalActionIndex((i) => Math.min(2, i + 1));
              lastButtonTime = now;
            } else if (btnA) {
              handleSelect(focusedRow, focusedCol);
              lastButtonTime = now;
            } else if (btnB) {
              handleBack();
              lastButtonTime = now;
            }
            continue;
          }

          if (up) {
            setFocusedRow((r) => {
              if (r === 0) {
                setFocusedCol(0);
                return -1;
              }
              if (r === -1) return -1;
              const currentIndex = activeRows.indexOf(r);
              if (currentIndex <= 0) {
                setFocusedCol(0);
                return -1;
              }
              const prevRow = activeRows[currentIndex - 1] ?? 0;
              setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(prevRow) - 1), c));
              return prevRow;
            });
            lastButtonTime = now;
          } else if (down) {
            setFocusedRow((r) => {
              if (r === -1) {
                setFocusedCol(0);
                return 0;
              }
              const currentIndex = activeRows.indexOf(r);
              const nextActiveIndex = currentIndex >= 0 && currentIndex < activeRows.length - 1 ? currentIndex + 1 : currentIndex;
              const nextRow = activeRows[nextActiveIndex] ?? r;
              setFocusedCol((c) => Math.min(Math.max(0, getRowItemCount(nextRow) - 1), c));
              return nextRow;
            });
            lastButtonTime = now;
          } else if (left) {
            setFocusedCol((c) => Math.max(0, c - 1));
            lastButtonTime = now;
          } else if (right) {
            const max = focusedRow === -1 ? 1 : Math.max(0, getRowItemCount(focusedRow) - 1);
            setFocusedCol((c) => Math.min(max, c + 1));
            lastButtonTime = now;
          } else if (btnA) {
            handleSelect(focusedRow, focusedCol);
            lastButtonTime = now;
          } else if (btnB) {
            handleBack();
            lastButtonTime = now;
          }
        }
      }

      setGamepadConnected(found);
      animId = requestAnimationFrame(pollGamepad);
    };

    animId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animId);
  }, [focusedRow, focusedCol, activeRows, activeTvModal, modalActionIndex, navigate]);

  // Smooth auto-scroll focused card into view
  useEffect(() => {
    if (focusedRow === -1) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const key = `${focusedRow}-${focusedCol}`;
    const el = itemRefs.current.get(key);
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [focusedRow, focusedCol]);

  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const watchHref = jellyfinWatchHref({
    ipv4,
    tailscaleIp,
    watch: watchDoor,
    hostname,
  });

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background select-none text-foreground font-sans">
      {/* Section 34: Thoughtful Standby Ambiance (The Hearth & Living Art Gallery) */}
      {isIdleAmbiance ? (
        <StandbyAmbiance onDismiss={() => setIsIdleAmbiance(false)} />
      ) : null}

      {/* Dynamic backdrop glow from featured hero */}
      {featuredTitle.backdrop || featuredTitle.poster ? (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30">
          <img
            src={featuredTitle.backdrop || featuredTitle.poster}
            alt=""
            className="size-full object-cover blur-3xl scale-125 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>
      ) : null}

      {/* Top 10-Foot HUD Bar */}
      <header className="relative z-30 flex items-center justify-between px-8 py-6 md:px-14">
        <div className="flex items-center gap-4">
          <Button
            ref={(el) => {
              if (el) itemRefs.current.set("-1-0", el);
            }}
            variant="ghost"
            onClick={() => void navigate({ to: "/" })}
            className={cn(
              "rounded-2xl border border-border bg-card/60 px-4 py-2 text-xs font-semibold text-muted hover:text-foreground transition-all cursor-pointer",
              focusedRow === -1 && focusedCol === 0 && "tv-focus-ring ring-4 ring-gold border-gold/80 text-foreground bg-card shadow-lg scale-105",
            )}
          >
            <ArrowLeft className="size-4" />
            Exit TV Mode
          </Button>

          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1 text-xs">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-live" />
            </span>
            <span className="font-display font-medium text-foreground">
              {houseName || "ReelOS Living Room"}
            </span>
          </div>
        </div>

        {/* Center Live Clock */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-5 py-1.5 font-display text-lg font-bold tracking-tight text-foreground shadow-sm">
          <Clock className="size-4 text-gold" />
          <span>{timeStr}</span>
        </div>

        {/* Right Status Badges */}
        <div className="flex items-center gap-3">
          {gamepadConnected ? (
            <div className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
              <Gamepad2 className="size-3.5" />
              <span>Controller Active</span>
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted">
            <Wifi className="size-3.5 text-success" />
            <span>LAN 1Gbps</span>
          </div>

          <button
            type="button"
            onClick={() => setIsIdleAmbiance(true)}
            className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
            title="The Hearth & Living Art Gallery Ambiance"
          >
            <Flame className="size-3.5 text-amber-400" />
            <span className="hidden sm:inline">Hearth</span>
          </button>

          <GuestQrPopover compact />
          <ThemeSwitcher compact />
          <ProfileSwitcher compact />

          <button
            ref={(el) => {
              if (el) itemRefs.current.set("-1-1", el);
            }}
            type="button"
            onClick={toggleFullscreen}
            className={cn(
              "flex size-9 items-center justify-center rounded-xl border border-border bg-card/60 text-muted hover:text-foreground transition-all cursor-pointer",
              focusedRow === -1 && focusedCol === 1 && "tv-focus-ring ring-4 ring-gold border-gold/80 text-foreground bg-card shadow-lg scale-105",
            )}
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </header>

      {/* Main 10-Foot Content */}
      <main className="relative z-10 px-8 pb-32 pt-2 md:px-14 space-y-12">
        {/* ROW 0: Hero Spotlight Banner */}
        <section
          ref={(el) => {
            if (el) itemRefs.current.set("0-0", el);
          }}
          onClick={() => handleSelect(0, 0)}
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-3xl border border-border transition-all duration-300",
            focusedRow === 0
              ? "tv-focus-ring ring-4 ring-gold border-gold/80 shadow-2xl scale-[1.01]"
              : "hover:border-border-strong",
          )}
        >
          <div className="relative h-[48vh] min-h-[380px] w-full overflow-hidden bg-card">
            {featuredTitle.backdrop || featuredTitle.poster ? (
              <img
                src={featuredTitle.backdrop || featuredTitle.poster}
                alt=""
                className="size-full object-cover object-center opacity-70"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-card to-card-2" />
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

            {/* Hero Copy */}
            <div className="absolute bottom-10 left-10 max-w-2xl space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-gold px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-gold-fg">
                  Featured Spotlight
                </span>
                <span className="rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md">
                  4K ULTRA HD
                </span>
                <span className="rounded-full border border-white/20 bg-background/60 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-md">
                  DOLBY VISION
                </span>
                {featuredTitle.year ? (
                  <span className="text-xs text-muted font-medium">
                    {featuredTitle.year}
                  </span>
                ) : null}
              </div>

              <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl drop-shadow-md">
                {featuredTitle.title}
              </h1>

              <p className="line-clamp-3 text-base text-muted/90 leading-relaxed max-w-xl">
                {featuredTitle.overview ||
                  "Ultra-crisp 4K HDR playback powered by ReelOS. High-fashion cinema experience with instant cloud streaming."}
              </p>

              <div className="flex items-center gap-4 pt-2">
                <Button
                  size="lg"
                  variant="gold"
                  className="rounded-2xl px-6 py-5 font-display text-base font-bold shadow-[var(--shadow-gold)]"
                >
                  <Play className="size-5 fill-current" />
                  Watch Now
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="rounded-2xl border border-border bg-card/70 px-5 text-sm font-medium backdrop-blur-md"
                >
                  View Details
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ROW 1: Continue Watching Carousel */}
        {continueWatching.length > 0 ? (
          <TvCarousel
            title="Continue Watching"
            rowIndex={1}
            focusedRow={focusedRow}
            focusedCol={focusedCol}
            itemRefs={itemRefs}
            onSelect={handleSelect}
          >
            {continueWatching.map((item, idx) => (
              <TvTitleCard
                key={`cw-${item.title.id}`}
                title={item.title}
                progress={item.progress}
                isFocused={focusedRow === 1 && focusedCol === idx}
                ref={(el) => {
                  if (el) itemRefs.current.set(`1-${idx}`, el);
                }}
                onClick={() => handleSelect(1, idx)}
              />
            ))}
          </TvCarousel>
        ) : null}

        {/* ROW 2: Recently Added Carousel */}
        {recentlyAdded.length > 0 ? (
          <TvCarousel
            title="Recently Added to House"
            rowIndex={2}
            focusedRow={focusedRow}
            focusedCol={focusedCol}
            itemRefs={itemRefs}
            onSelect={handleSelect}
          >
            {recentlyAdded.map((t, idx) => (
              <TvTitleCard
                key={`ra-${t.id}`}
                title={t}
                isFocused={focusedRow === 2 && focusedCol === idx}
                ref={(el) => {
                  if (el) itemRefs.current.set(`2-${idx}`, el);
                }}
                onClick={() => handleSelect(2, idx)}
              />
            ))}
          </TvCarousel>
        ) : null}

        {/* ROW 3: Pick Tonight Carousel */}
        {pickTonight.length > 0 ? (
          <TvCarousel
            title="Pick Tonight"
            rowIndex={3}
            focusedRow={focusedRow}
            focusedCol={focusedCol}
            itemRefs={itemRefs}
            onSelect={handleSelect}
          >
            {pickTonight.map((t, idx) => (
              <TvTitleCard
                key={`pt-${t.id}`}
                title={t}
                isFocused={focusedRow === 3 && focusedCol === idx}
                ref={(el) => {
                  if (el) itemRefs.current.set(`3-${idx}`, el);
                }}
                onClick={() => handleSelect(3, idx)}
              />
            ))}
          </TvCarousel>
        ) : null}
      </main>

      {/* 10-Foot TV Quick Action Modal */}
      {activeTvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 p-8">
          <div className="relative max-w-2xl w-full rounded-3xl border border-gold/40 bg-card/95 p-8 shadow-2xl space-y-6">
            <div className="flex gap-6 items-start">
              <div className="w-36 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border border-border shadow-lg">
                <Poster title={activeTvModal} className="size-full object-cover" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold border border-gold/40">
                    4K DirectPlay
                  </span>
                  {activeTvModal.year ? (
                    <span className="text-xs text-muted font-medium">{activeTvModal.year}</span>
                  ) : null}
                </div>
                <h2 className="font-display text-3xl font-extrabold text-foreground">
                  {activeTvModal.title}
                </h2>
                <p className="line-clamp-4 text-xs text-muted leading-relaxed">
                  {activeTvModal.overview ||
                    "High-bitrate cinema playback with instant streaming and local hardware acceleration."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  void navigate({ to: "/play/$id", params: { id: activeTvModal.id } });
                }}
                className={cn(
                  "flex items-center gap-2 rounded-2xl px-6 py-3 font-display text-sm font-bold transition-all cursor-pointer",
                  modalActionIndex === 0
                    ? "bg-gold text-background ring-4 ring-gold/40 scale-105 shadow-lg shadow-gold/20"
                    : "bg-gold/20 text-gold hover:bg-gold/30",
                )}
              >
                <Play className="size-4 fill-current" />
                Play Now
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigate({ to: "/title/$id", params: { id: activeTvModal.id } });
                }}
                className={cn(
                  "rounded-2xl border px-5 py-3 text-sm font-medium transition-all cursor-pointer",
                  modalActionIndex === 1
                    ? "border-gold bg-card ring-4 ring-gold/40 scale-105 text-foreground"
                    : "border-border bg-card/60 text-muted hover:text-foreground",
                )}
              >
                Full Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTvModal(null)}
                className={cn(
                  "rounded-2xl px-5 py-3 text-sm font-medium transition-all cursor-pointer",
                  modalActionIndex === 2
                    ? "bg-muted/30 text-foreground ring-4 ring-white/20 scale-105"
                    : "text-muted hover:text-foreground",
                )}
              >
                Back to Couch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating 10-Foot Remote Navigation Legend */}
      <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-border bg-background/85 px-10 py-3.5 backdrop-blur-xl text-xs text-muted">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 font-medium">
            <kbd className="rounded bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground border border-border">
              ▲▼
            </kbd>
            <span>Rows</span>
          </span>

          <span className="flex items-center gap-1.5 font-medium">
            <kbd className="rounded bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground border border-border">
              ◀▶
            </kbd>
            <span>Browse</span>
          </span>

          <span className="flex items-center gap-1.5 font-medium">
            <kbd className="rounded bg-card-2 px-2 py-0.5 font-mono text-[10px] text-gold border border-gold/40">
              Enter / Ⓐ
            </kbd>
            <span>Select</span>
          </span>

          <span className="flex items-center gap-1.5 font-medium">
            <kbd className="rounded bg-card-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground border border-border">
              Esc / Ⓑ
            </kbd>
            <span>Back</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-faint">ReelOS 10-Foot Living Room Mode</span>
        </div>
      </footer>
    </div>
  );
}

function TvCarousel({
  title,
  children,
}: {
  title: string;
  rowIndex: number;
  focusedRow: number;
  focusedCol: number;
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  onSelect: (r: number, c: number) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="no-scrollbar flex gap-5 overflow-x-auto pb-6 pt-2">
        {children}
      </div>
    </section>
  );
}

interface TvTitleCardProps {
  title: Title;
  progress?: number;
  isFocused: boolean;
  onClick: () => void;
}

const TvTitleCard = forwardRef<HTMLDivElement, TvTitleCardProps>(function TvTitleCard(
  { title, progress, isFocused, onClick },
  ref,
) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      tabIndex={0}
      data-focused={isFocused ? "true" : undefined}
      className={cn(
        "tv-focus-ring group relative w-[220px] min-w-[220px] shrink-0 cursor-pointer rounded-2xl overflow-hidden transition-all duration-300",
        isFocused
          ? "ring-4 ring-gold scale-[1.08] z-20 shadow-2xl shadow-gold/30"
          : "hover:scale-[1.02] opacity-85 hover:opacity-100",
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-card border border-border">
        <Poster title={title} className="size-full rounded-2xl object-cover" />

        {/* 4K HDR Capsule Badge */}
        <span className="absolute right-2.5 top-2.5 rounded-full border border-white/20 bg-background/80 px-2 py-0.5 text-[9px] font-bold tracking-wider text-foreground backdrop-blur-md">
          4K HDR
        </span>

        {/* Watch Progress bar */}
        {typeof progress === "number" && progress > 0.03 ? (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-background/60">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 space-y-0.5 px-1">
        <p className="truncate font-display text-sm font-semibold text-foreground">
          {title.title}
        </p>
        <p className="text-xs text-muted">
          {title.year || "4K DirectPlay"}
        </p>
      </div>
    </div>
  );
});

