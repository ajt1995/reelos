import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { LuxuryPinInput } from "@/components/luxury-pin-input";
import { LuxuryInputCard } from "@/components/luxury-input-card";

type Step =
  | "name"
  | "color"
  | "household"
  | "guidance"
  | "taste"
  | "path"
  | "torbox"
  | "devices";

const INTERESTS = [
  "Dune",
  "The Bear",
  "Severance",
  "Blade Runner 2049",
  "Interstellar",
  "Spirited Away",
  "Succession",
  "Chernobyl",
  "Everything Everywhere All at Once",
  "The Matrix",
  "Past Lives",
  "The Dark Knight",
  "The Batman",
  "Paddington 2",
  "Arrival",
  "The Sopranos",
  "The Last of Us",
  "The Holdovers",
  "The Shining",
  "Mad Max: Fury Road",
  "Florence Pugh",
  "Pedro Pascal",
  "Zendaya",
  "Oscar Isaac",
  "Viola Davis",
  "Keanu Reeves",
  "Robert Pattinson",
  "Emma Stone",
  "Ryan Gosling",
  "Kieran Culkin",
  "Ayo Edebiri",
  "Lakeith Stanfield",
  "Slow-burn noir · Blade Runner 2049",
  "Cozy whimsy · Spirited Away",
  "Big feelings · Everything Everywhere",
  "Sunday comfort · The Holdovers",
];

export function OnboardingFlow({
  onColor,
  onFinish,
}: {
  onColor(color: string): void;
  onFinish(): void;
}) {
  const [name, setName] = useState("");
  const [profilePinEnabled, setProfilePinEnabled] = useState(false);
  const [profilePin, setProfilePin] = useState("");
  const [step, setStep] = useState<Step>("name");
  const [guidance, setGuidance] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [color, setColor] = useState("#2563eb");
  const [torboxKey, setTorboxKey] = useState("");
  const [tastes, setTastes] = useState<Record<string, number>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [shown, setShown] = useState(14);

  const visible = useMemo(
    () => INTERESTS.filter((item) => !dismissed.includes(item)).slice(0, shown),
    [dismissed, shown],
  );
  const chooseTaste = (item: string) =>
    setTastes((current) => ({
      ...current,
      [item]: ((current[item] ?? 0) + 1) % 3,
    }));
  const next = () =>
    setStep(
      step === "name"
        ? "color"
        : step === "color"
          ? "household"
          : step === "household"
            ? "guidance"
            : step === "guidance"
              ? "taste"
              : step === "taste"
                ? "path"
                : "devices",
    );

  return (
    <main className="reelos-onboarding relative flex min-h-dvh flex-col overflow-y-auto px-5 py-8 md:px-10 pb-36 md:pb-16">
      <div className="reelos-onboarding-orb reelos-onboarding-orb-one" />
      <div className="reelos-onboarding-orb reelos-onboarding-orb-two" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center py-6 sm:py-12">
        <div className="w-full">
          {step === "name" && (
            <div className="max-w-2xl">
              <h1 className="font-display text-[clamp(2.4rem,5.5vw,5.2rem)] font-semibold leading-[.96] tracking-[-.06em]">
                Hi, what should we call you?
              </h1>
              <p className="mt-3 text-base sm:text-lg text-white/55">
                Your profile keeps its own taste, history, books, and atmosphere.
              </p>
              <div className="mt-8 space-y-5">
                <LuxuryInputCard
                  label="Profile Name"
                  placeholder="Your name"
                  value={name}
                  onChange={setName}
                  autoFocus
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      name.trim() &&
                      (!profilePinEnabled || profilePin.length === 4)
                    )
                      next();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setProfilePinEnabled((enabled) => !enabled)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition duration-300 ${
                    profilePinEnabled
                      ? "border-[#f0ba61]/60 bg-white/[0.08] shadow-[0_0_24px_rgba(240,186,97,0.12)]"
                      : "border-white/12 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <span>
                    <span className="block text-base font-semibold text-white">
                      Add a passcode
                    </span>
                    <span className="mt-0.5 block text-xs sm:text-sm text-white/50">
                      Optional — keep this profile private.
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-12 items-center rounded-full p-1 transition duration-200 ${
                      profilePinEnabled
                        ? "justify-end bg-[#f0ba61] text-[#1a1406]"
                        : "justify-start bg-white/15 text-white/40"
                    }`}
                  >
                    <span className="h-5 w-5 rounded-full bg-current shadow-sm" />
                  </span>
                </button>
                {profilePinEnabled && (
                  <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">
                      Create 4-Digit Passcode
                    </span>
                    <LuxuryPinInput
                      value={profilePin}
                      onChange={(val) => setProfilePin(val)}
                      length={4}
                      autoFocus
                      onComplete={(val) => {
                        if (name.trim() && val.length === 4) {
                          next();
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <button
                disabled={
                  !name.trim() || (profilePinEnabled && profilePin.length !== 4)
                }
                onClick={next}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-8 py-4 text-sm font-bold text-[#211507] shadow-[0_4px_24px_rgba(240,186,97,0.35)] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none transition-all duration-200 active:scale-95"
              >
                Continue
              </button>
            </div>
          )}
          {step === "color" && (
            <div className="max-w-3xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                What is your favorite color?
              </h1>
              <p className="mt-5 text-lg text-white/58">
                We’ll let it quietly shape your home.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                {[
                  "#2563eb",
                  "#e11d48",
                  "#f97316",
                  "#eab308",
                  "#22c55e",
                  "#06b6d4",
                  "#a855f7",
                  "#ec4899",
                ].map((swatch) => (
                  <button
                    key={swatch}
                    onClick={() => {
                      setColor(swatch);
                      onColor(swatch);
                    }}
                    aria-label={`Choose ${swatch}`}
                    className={`size-16 rounded-full transition ${color === swatch ? "scale-110 ring-4 ring-white/30" : "hover:scale-105"}`}
                    style={{
                      backgroundColor: swatch,
                      boxShadow: `0 0 32px ${swatch}88`,
                    }}
                  />
                ))}
                <label className="grid size-16 cursor-pointer place-items-center rounded-full border border-dashed border-white/30 text-xs text-white/50">
                  More
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => {
                      setColor(event.target.value);
                      onColor(event.target.value);
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
              <button
                onClick={next}
                className="reelos-play mt-10 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507]"
              >
                Continue
              </button>
            </div>
          )}
          {step === "household" && (
            <div className="max-w-3xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Who lives here?
              </h1>
              <p className="mt-5 text-lg text-white/58">
                Everyone gets their own taste and their own history.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <span className="reelos-person-tile">
                  <span className="grid size-20 place-items-center rounded-full bg-[#b8c7ff] text-2xl font-semibold text-[#111426]">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <b>{name}</b>
                </span>
                {members.map((member) => (
                  <button
                    key={member}
                    onClick={() =>
                      setMembers((items) =>
                        items.filter((item) => item !== member),
                      )
                    }
                    className="reelos-person-tile group"
                  >
                    <span className="grid size-20 place-items-center rounded-full bg-white/10 text-2xl font-semibold">
                      {member.slice(0, 1).toUpperCase()}
                    </span>
                    <b>{member}</b>
                    <small>Remove</small>
                  </button>
                ))}
                <button
                  onClick={() => setAddingMember(true)}
                  className="reelos-person-tile"
                >
                  <span className="grid size-20 place-items-center rounded-full border border-dashed border-white/30 text-3xl text-white/55">
                    +
                  </span>
                  <b>Add someone</b>
                </button>
              </div>
              {addingMember && (
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1">
                    <LuxuryInputCard
                      label="Household Member"
                      placeholder="Their name"
                      value={memberName}
                      onChange={setMemberName}
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && memberName.trim()) {
                          setMembers((items) => [...items, memberName.trim()]);
                          setMemberName("");
                          setAddingMember(false);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!memberName.trim()}
                      onClick={() => {
                        setMembers((items) => [...items, memberName.trim()]);
                        setMemberName("");
                        setAddingMember(false);
                      }}
                      className="rounded-2xl bg-[#f0ba61] px-6 py-4 text-sm font-bold text-[#211507] shadow-[0_4px_20px_rgba(240,186,97,0.3)] disabled:opacity-30 disabled:shadow-none transition-all duration-200 active:scale-95 shrink-0"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberName("");
                        setAddingMember(false);
                      }}
                      className="rounded-2xl border border-white/12 px-4 py-4 text-sm font-medium text-white/60 hover:bg-white/10 transition-all shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={next}
                className="reelos-play mt-10 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507]"
              >
                {members.length ? "Continue together" : "Just me for now"}
              </button>
            </div>
          )}
          {step === "guidance" && (
            <div className="max-w-4xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                How much hand-holding do you want?
              </h1>
              <div className="mt-10 grid gap-3 md:grid-cols-3">
                {[
                  ["Hold my hand", "Guide me, make smart choices."],
                  ["Balanced", "Keep it simple. I’ll ask when I need you."],
                  ["I’ll figure it out", "Get me to the cinema."],
                ].map(([title, note]) => (
                  <button
                    key={title}
                    onClick={() => setGuidance(title)}
                    className={`reelos-guidance rounded-[1.5rem] border p-6 text-left ${guidance === title ? "border-[#eebd69] bg-white/10" : "border-white/10 bg-black/10"}`}
                  >
                    <b className="block text-lg">{title}</b>
                    <span className="mt-3 block text-sm leading-6 text-white/55">
                      {note}
                    </span>
                  </button>
                ))}
              </div>
              <button
                disabled={!guidance}
                onClick={next}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Continue
              </button>
            </div>
          )}
          {step === "taste" && (
            <div>
              <div className="max-w-2xl">
                <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                  Who and what do you love?
                </h1>
                <p className="mt-5 text-lg text-white/58">
                  Tap once for like, twice for love. Throw away anything that
                  isn’t you.
                </p>
              </div>
              <div className="reelos-infinite-field mt-8">
                {visible.map((item, index) => (
                  <span
                    key={item}
                    className={`reelos-infinite-bubble size-${index % 4} state-${tastes[item] ?? 0}`}
                  >
                    <button onClick={() => chooseTaste(item)}>
                      {item}
                      {tastes[item] === 2 && <small>♥</small>}
                    </button>
                    <button
                      onClick={() => setDismissed((items) => [...items, item])}
                      aria-label={`Dismiss ${item}`}
                      className="reelos-dismiss"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    setShown((count) => Math.min(count + 12, INTERESTS.length))
                  }
                  className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 hover:border-white/40"
                >
                  More people & titles
                </button>
                <button
                  onClick={next}
                  className="reelos-play rounded-full bg-[#f0ba61] px-6 py-3 text-sm font-bold text-[#211507]"
                >
                  {Object.keys(tastes).length
                    ? "That feels right"
                    : "Surprise me"}
                </button>
              </div>
            </div>
          )}
          {step === "path" && (
            <div className="max-w-4xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Where is your cinema?
              </h1>
              <div className="mt-10 grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => setStep("torbox")}
                  className="reelos-guidance rounded-[1.7rem] border border-white/15 bg-white/8 p-7 text-left"
                >
                  <b className="block text-2xl">Start this home</b>
                  <span className="mt-3 block text-sm leading-6 text-white/58">
                    Set up this ReelOS home on its own.
                  </span>
                </button>
                <button
                  onClick={() => setStep("torbox")}
                  className="reelos-guidance rounded-[1.7rem] border border-white/15 bg-white/8 p-7 text-left"
                >
                  <b className="block text-2xl">Connect to my home</b>
                  <span className="mt-3 block text-sm leading-6 text-white/58">
                    Pair with a ReelOS server already in your house.
                  </span>
                </button>
              </div>
            </div>
          )}
          {step === "torbox" && (
            <div className="max-w-2xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Bring your cinema to life.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/58">
                Add your TorBox API key to unlock your own library, instant
                requests, and private streaming throughout your home.
              </p>
              <div className="mt-8">
                <LuxuryInputCard
                  type="password"
                  label="TorBox API Key"
                  placeholder="Paste your TorBox API key"
                  value={torboxKey}
                  onChange={setTorboxKey}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && torboxKey.trim()) {
                      setStep("devices");
                    }
                  }}
                />
              </div>
              <button
                disabled={!torboxKey.trim()}
                onClick={() => setStep("devices")}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Continue
              </button>
              <p className="mt-5 text-sm text-white/38">
                Stored only in your ReelOS home. You can change it in Settings
                anytime.
              </p>
            </div>
          )}
          {step === "devices" && (
            <div className="max-w-5xl">
              <h1 className="font-display text-[clamp(3.1rem,6vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Where should ReelOS go next?
              </h1>
              <p className="mt-5 text-lg text-white/58">
                Your home is ready. Take ReelOS to the screens and devices you
                use.
              </p>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <button
                  onClick={onFinish}
                  className="reelos-device-card rounded-[1.7rem] border border-white/12 p-6 text-left"
                >
                  <span className="text-4xl">▣</span>
                  <b className="mt-10 block text-xl">Phone</b>
                  <span className="mt-2 block text-sm leading-6 text-white/55">
                    Scan to pair your personal taste, books, and companion.
                  </span>
                </button>
                <button
                  onClick={onFinish}
                  className="reelos-device-card rounded-[1.7rem] border border-white/12 p-6 text-left"
                >
                  <span className="text-4xl">▰</span>
                  <b className="mt-10 block text-xl">TV</b>
                  <span className="mt-2 block text-sm leading-6 text-white/55">
                    Install the ten-foot cinema experience for your home.
                  </span>
                </button>
                <button
                  onClick={onFinish}
                  className="reelos-device-card rounded-[1.7rem] border border-white/12 p-6 text-left"
                >
                  <span className="text-4xl">▱</span>
                  <b className="mt-10 block text-xl">Make a USB</b>
                  <span className="mt-2 block text-sm leading-6 text-white/55">
                    Flash a dedicated ReelOS appliance when you’re ready.
                  </span>
                </button>
              </div>
              <button
                onClick={onFinish}
                className="mt-8 text-sm text-white/55 hover:text-white"
              >
                I’ll do this later
              </button>
            </div>
          )}
          {(step === "color" || step === "guidance") && (
            <button
              onClick={next}
              className="mt-4 text-sm text-white/45 hover:text-white"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
