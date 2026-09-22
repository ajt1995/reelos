import React, { useEffect, useState, useRef } from "react";
import { Flame, Image as ImageIcon, Sparkles, X, ChevronRight, ChevronLeft, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StandbyMode = "campfire" | "gallery" | "photos";

interface StandbyPhoto {
  id: string;
  filename: string;
  url: string;
  timestamp?: number;
}

const GALLERY_ARTWORKS = [
  {
    title: "Wanderer above the Sea of Fog",
    artist: "Caspar David Friedrich",
    year: "1818",
    url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1920&q=80",
  },
  {
    title: "Starry Night Over the Rhône",
    artist: "Vincent van Gogh",
    year: "1888",
    url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1920&q=80",
  },
  {
    title: "The Great Wave off Kanagawa",
    artist: "Katsushika Hokusai",
    year: "1831",
    url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1920&q=80",
  },
];

export function StandbyAmbiance({
  initialMode = "campfire",
  onDismiss,
}: {
  initialMode?: StandbyMode;
  onDismiss?: () => void;
}) {
  const [mode, setMode] = useState<StandbyMode>(initialMode);
  const [artIndex, setArtIndex] = useState(0);
  const [photos, setPhotos] = useState<StandbyPhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  // Fetch sovereign photos from local ReelOS state
  useEffect(() => {
    let active = true;
    fetch("/api/standby/photos")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.photos) && data.photos.length > 0) {
          setPhotos(data.photos);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Cycle art or photos periodically
  useEffect(() => {
    if (mode === "gallery") {
      const interval = setInterval(() => {
        setArtIndex((prev) => (prev + 1) % GALLERY_ARTWORKS.length);
      }, 25000);
      return () => clearInterval(interval);
    }
    if (mode === "photos" && photos.length > 1) {
      const interval = setInterval(() => {
        setPhotoIndex((prev) => (prev + 1) % photos.length);
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [mode, photos.length]);

  // Ambient crackle sound synthesized via Web Audio API for Campfire mode
  const toggleSound = () => {
    if (soundEnabled) {
      try {
        audioContextRef.current?.close();
      } catch {}
      audioContextRef.current = null;
      setSoundEnabled(false);
      return;
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      // Brown noise generator for warm fireplace rumble
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // boost gain
      }

      const brownNoise = ctx.createBufferSource();
      brownNoise.buffer = buffer;
      brownNoise.loop = true;

      // Low pass filter
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 350;

      const gain = ctx.createGain();
      gain.gain.value = 0.08;

      brownNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      brownNoise.start();
      noiseNodeRef.current = brownNoise;
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(false);
    }
  };

  useEffect(() => {
    return () => {
      try {
        audioContextRef.current?.close();
      } catch {}
    };
  }, []);

  const currentArt = GALLERY_ARTWORKS[artIndex];
  const currentPhoto = photos.length > 0 ? photos[photoIndex % photos.length] : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black text-foreground select-none overflow-hidden animate-in fade-in duration-1000"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " " || e.key === "ArrowLeft" || e.key === "ArrowRight") {
          onDismiss?.();
        }
      }}
    >
      {/* Background Visual Render */}
      {mode === "campfire" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
          {/* Deep ambient glow */}
          <div className="absolute inset-0 bg-gradient-radial from-amber-950/40 via-black to-black opacity-80" />
          
          {/* Subtle animated embers simulation */}
          <div className="relative w-full max-w-4xl h-96 flex flex-col items-center justify-center text-center">
            <div className="relative flex items-center justify-center">
              <div className="size-64 rounded-full bg-amber-500/20 blur-3xl animate-pulse duration-1000" />
              <div className="size-48 rounded-full bg-orange-600/30 blur-2xl animate-pulse duration-700" />
              <div className="size-24 rounded-full bg-yellow-400/40 blur-xl" />
              <Flame className="size-28 text-amber-500/90 drop-shadow-[0_0_35px_rgba(245,158,11,0.6)] animate-bounce duration-1000" />
            </div>
            <div className="mt-8 space-y-2 z-10">
              <p className="font-serif text-2xl font-light tracking-wide text-amber-200/90">The Hearth</p>
              <p className="font-mono text-xs text-amber-400/60 uppercase tracking-widest">Thoughtful Living Room Ambiance</p>
            </div>
          </div>
        </div>
      )}

      {mode === "gallery" && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <img
            key={currentArt.url}
            src={currentArt.url}
            alt={currentArt.title}
            className="size-full object-cover opacity-85 transition-opacity duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="absolute bottom-12 left-12 space-y-1.5 z-10 max-w-lg">
            <p className="font-serif text-2xl font-bold tracking-tight text-white drop-shadow-md">
              {currentArt.title}
            </p>
            <p className="text-sm text-zinc-300 font-sans">
              {currentArt.artist}, <span className="text-zinc-400 font-mono">{currentArt.year}</span>
            </p>
            <p className="text-[11px] font-mono uppercase tracking-widest text-gold/80 pt-1">
              Living Art Gallery · High-Fidelity
            </p>
          </div>
        </div>
      )}

      {mode === "photos" && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          {currentPhoto ? (
            <>
              <img
                key={currentPhoto.url}
                src={currentPhoto.url}
                alt="Family Memory"
                className="size-full object-contain p-8 opacity-90 transition-opacity duration-1000"
              />
              <div className="absolute bottom-10 left-10 space-y-1 z-10">
                <p className="font-serif text-xl font-medium text-white">Sovereign Family Photo Wall</p>
                <p className="text-xs font-mono text-zinc-400">Memories stored on this ReelOS home</p>
              </div>
            </>
          ) : (
            <div className="text-center space-y-3 p-6 max-w-sm">
              <ImageIcon className="size-12 text-muted mx-auto opacity-50" />
              <p className="text-sm font-medium text-foreground">No Local Photos Yet</p>
              <p className="text-xs text-muted leading-relaxed">
                Send personal photos directly to your TV from the Second Screen Companion app.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floating Control HUD */}
      <div className="absolute top-8 right-8 z-30 flex items-center gap-3">
        {mode === "campfire" && (
          <Button
            size="sm"
            variant="quiet"
            onClick={toggleSound}
            className="rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/80 hover:text-white px-3"
            title={soundEnabled ? "Mute Hearth" : "Hear Ambient Hearth"}
          >
            {soundEnabled ? <Volume2 className="size-4 text-amber-400" /> : <VolumeX className="size-4" />}
            <span className="text-xs font-mono">{soundEnabled ? "Audio On" : "Audio Off"}</span>
          </Button>
        )}

        <div className="flex items-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 p-1">
          <button
            type="button"
            onClick={() => setMode("campfire")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-mono transition-colors",
              mode === "campfire" ? "bg-gold text-black font-bold" : "text-muted hover:text-foreground"
            )}
          >
            Hearth
          </button>
          <button
            type="button"
            onClick={() => setMode("gallery")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-mono transition-colors",
              mode === "gallery" ? "bg-gold text-black font-bold" : "text-muted hover:text-foreground"
            )}
          >
            Gallery
          </button>
          <button
            type="button"
            onClick={() => setMode("photos")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-mono transition-colors",
              mode === "photos" ? "bg-gold text-black font-bold" : "text-muted hover:text-foreground"
            )}
          >
            Family Wall
          </button>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex size-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors"
            title="Return to Cinema Home"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="absolute bottom-6 right-8 text-[11px] font-mono text-zinc-500 pointer-events-none">
        Press any key to resume
      </div>
    </div>
  );
}
