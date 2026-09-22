import React, { useEffect, useRef, useState } from "react";
import { showToast } from "@/lib/toast";

interface HeadlessScreenProps {
  onWake: () => void;
}

export function HeadlessScreen({ onWake }: HeadlessScreenProps) {
  const tapsRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    // Hide cursor during headless mode to avoid display wakeups
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "none";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        const now = Date.now();
        // Rolling 2.5 second window
        tapsRef.current = [...tapsRef.current.filter((t) => now - t < 2500), now];
        setTapCount(tapsRef.current.length);

        if (tapsRef.current.length >= 5) {
          tapsRef.current = [];
          wakeUp();
        }
      }
    };

    const wakeUp = async () => {
      try {
        await fetch("/api/system/remote-compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        });
      } catch {}
      showToast("Display Awakened · Welcome Back", "success");
      onWake();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.cursor = prevCursor;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onWake]);

  // Touch screen backup: 5 rapid taps on screen wakes as well
  const handleScreenTouch = () => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 2500), now];
    if (tapsRef.current.length >= 5) {
      tapsRef.current = [];
      fetch("/api/system/remote-compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }).catch(() => {});
      showToast("Display Awakened · Welcome Back", "success");
      onWake();
    }
  };

  return (
    <div
      onClick={handleScreenTouch}
      className="fixed inset-0 z-[9999] bg-black cursor-none select-none flex items-center justify-center"
      style={{ backgroundColor: "#000000" }}
    >
      {/* 100% black screen for zero OLED/panel power draw. 
          Whisper indicator only during active spacebar taps */}
      {tapCount > 1 && (
        <div className="text-[11px] font-mono text-white/20 select-none animate-pulse">
          Awakening ({tapCount}/5 Spacebar taps)...
        </div>
      )}
    </div>
  );
}
