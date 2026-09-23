import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  RefreshCw,
  Shield,
  Smartphone,
  Sparkles,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { LuxuryPinInput } from "@/components/luxury-pin-input";

export function HouseholdGateView() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code" | "verifying_token" | "success">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [platformName, setPlatformName] = useState("Personal Device");

  // Detect platform name
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("iphone")) setPlatformName("Apple iPhone");
      else if (ua.includes("ipad")) setPlatformName("Apple iPad");
      else if (ua.includes("android")) setPlatformName("Android Device");
      else if (ua.includes("macintosh") || ua.includes("mac os")) setPlatformName("Mac Computer");
      else if (ua.includes("windows")) setPlatformName("Windows PC");
      else if (ua.includes("linux")) setPlatformName("Linux Computer");
      else if (ua.includes("cros")) setPlatformName("Chromebook");
      else setPlatformName("Personal Device");
    }
  }, []);

  // Check URL parameters for magic link token on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setStep("verifying_token");
      void verifyToken(token);
    }
  }, []);

  // 10-minute countdown timer when on code step
  useEffect(() => {
    if (step !== "code" || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const verifyToken = async (tokenString: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenString }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStep("success");
        showToast("Device authorized successfully!", "success");
        setTimeout(() => {
          useReelStore.getState().setRemoteChallenged(false);
          if (typeof window !== "undefined") {
            window.history.replaceState({}, document.title, "/");
          }
          navigate({ to: "/" });
        }, 1200);
      } else {
        setError(data.error || "Magic link has expired or is invalid.");
        setStep("email");
      }
    } catch (err) {
      setError("Failed to verify magic link. Please enter your email below.");
      setStep("email");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStep("code");
        setTimeLeft(data.expiresInSec || 600);
        if (data.debugCode) {
          setDebugOtp(data.debugCode);
        }
        showToast(`Pairing code sent to ${cleanEmail}`, "info");
      } else {
        setError(data.error || "Failed to send pairing code. Please try again.");
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : "Network error."));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: cleanCode }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStep("success");
        showToast("Device paired for 1 year!", "success");
        setTimeout(() => {
          useReelStore.getState().setRemoteChallenged(false);
          window.location.href = "/";
        }, 1200);
      } else {
        setError(data.error || "Incorrect verification code. Please check and try again.");
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : "Verification error."));
    } finally {
      setBusy(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-2xl p-4">
      <div className="w-full max-w-md rounded-3xl border border-gold/25 bg-card/90 p-6 md:p-8 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {/* Header Branding */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30">
              <Shield className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-foreground">ReelOS</span>
                <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-semibold text-gold border border-gold/25">
                  Household Gate
                </span>
              </div>
              <p className="text-xs text-muted">Secure Family Access</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-faint bg-muted/20 px-2.5 py-1 rounded-full border border-border/40">
            {platformName.includes("iPhone") || platformName.includes("Android") ? (
              <Smartphone className="size-3.5 text-gold" />
            ) : platformName.includes("TV") ? (
              <Tv className="size-3.5 text-gold" />
            ) : (
              <Laptop className="size-3.5 text-gold" />
            )}
            <span>{platformName}</span>
          </div>
        </div>

        {/* Step: Verifying Magic Link Token */}
        {step === "verifying_token" && (
          <div className="py-12 text-center">
            <Loader2 className="size-10 animate-spin text-gold mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Authorizing Device…</h2>
            <p className="text-sm text-muted mt-1">Verifying your secure sign-in link…</p>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success/20 text-success border border-success/30">
              <CheckCircle2 className="size-8" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Device Authorized!</h2>
            <p className="text-sm text-muted mt-1">Welcome home. Opening your library…</p>
          </div>
        )}

        {/* Step 1: Email Form */}
        {step === "email" && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-foreground">Enter Household Email</h2>
              <p className="text-xs text-muted mt-1">
                Enter your family email address to receive a one-time pairing code or magic link.
              </p>
            </div>

            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <input
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="family@home.local"
                  disabled={busy}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-card/80 text-foreground placeholder:text-muted/50 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold text-sm font-medium"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={busy || !email.trim()}
                className="w-full bg-gold text-gold-fg font-semibold py-2.5 rounded-xl hover:bg-gold-bright transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-gold/10"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending Code…
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    Send Pairing Code
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border/40 text-center">
              <p className="text-[11px] text-faint">
                Once verified, this device remains connected for 1 year across cellular and Wi-Fi networks.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 6-Digit Code Entry */}
        {step === "code" && (
          <div>
            <div className="mb-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Enter 6-Digit Code</h2>
                <span className="font-mono text-xs text-gold bg-gold/10 px-2 py-0.5 rounded-md border border-gold/20">
                  {formatTimer(timeLeft)}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                Sent to <span className="font-medium text-foreground">{email}</span>. Check your inbox or spam folder.
              </p>
            </div>

            {import.meta.env.DEV && debugOtp ? (
              <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-2.5 text-center">
                <span className="text-xs text-muted">Development Code: </span>
                <span className="font-mono font-bold text-gold text-sm tracking-wider">{debugOtp}</span>
              </div>
            ) : null}

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="py-2 flex justify-center">
                <LuxuryPinInput
                  value={code}
                  onChange={(val) => setCode(val)}
                  length={6}
                  disabled={busy}
                  autoFocus
                  onComplete={() => {
                    if (code.length === 6 && !busy && timeLeft > 0) {
                      void handleVerifyOtp();
                    }
                  }}
                />
              </div>

              {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                  {error}
                </div>
              )}

              {timeLeft <= 0 && !error && (
                <div className="rounded-xl border border-gold/30 bg-gold/10 p-2.5 text-center text-xs text-gold">
                  ⏱️ This 6-digit code has expired. Tap 'Resend code' below to receive a new one.
                </div>
              )}

              <Button
                type="submit"
                disabled={busy || code.length !== 6 || timeLeft <= 0}
                className="w-full bg-gold text-gold-fg font-semibold py-2.5 rounded-xl hover:bg-gold-bright transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-gold/10"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Authorize This Device
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs text-muted pt-4 border-t border-border/40">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError("");
                }}
                className="hover:text-gold transition-colors cursor-pointer"
              >
                Use different email
              </button>
              <button
                type="button"
                disabled={busy || timeLeft > 540}
                onClick={handleRequestOtp}
                className="flex items-center gap-1 hover:text-gold disabled:opacity-40 transition-colors cursor-pointer"
              >
                <RefreshCw className="size-3" />
                {timeLeft > 540 ? `Resend in ${timeLeft - 540}s` : "Resend code"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
