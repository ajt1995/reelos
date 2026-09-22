import { X } from "lucide-react";
import { useMemo, useState } from "react";

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
    <main className="reelos-onboarding relative flex min-h-dvh overflow-hidden px-5 py-10 md:px-10">
      <div className="reelos-onboarding-orb reelos-onboarding-orb-one" />
      <div className="reelos-onboarding-orb reelos-onboarding-orb-two" />
      <div className="relative mx-auto flex w-full max-w-6xl items-center">
        <div className="w-full">
          {step === "name" && (
            <div className="max-w-2xl">
              <h1 className="font-display text-[clamp(3.3rem,7vw,6.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
                Hi, what should we call you?
              </h1>
              <div className="mt-10 border-b border-white/25">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      name.trim() &&
                      (!profilePinEnabled || profilePin.length === 4)
                    )
                      next();
                  }}
                  placeholder="Your name"
                  className="w-full bg-transparent py-4 text-2xl font-medium outline-none placeholder:text-white/25"
                />
              </div>
              <button
                type="button"
                onClick={() => setProfilePinEnabled((enabled) => !enabled)}
                className={`mt-7 flex w-full items-center justify-between rounded-[1.35rem] border px-5 py-4 text-left transition ${profilePinEnabled ? "border-white/60 bg-white/10" : "border-white/15 bg-black/10 hover:border-white/35"}`}
              >
                <span>
                  <span className="block text-base font-semibold">
                    Add a passcode
                  </span>
                  <span className="mt-1 block text-sm text-white/52">
                    Optional — keep this profile private.
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-12 items-center rounded-full p-1 transition ${profilePinEnabled ? "justify-end bg-white text-[#101016]" : "justify-start bg-white/15 text-white/45"}`}
                >
                  <span className="h-5 w-5 rounded-full bg-current" />
                </span>
              </button>
              {profilePinEnabled && (
                <div className="mt-3 border-b border-white/25">
                  <input
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={profilePin}
                    onChange={(event) =>
                      setProfilePin(
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        name.trim() &&
                        profilePin.length === 4
                      )
                        next();
                    }}
                    placeholder="Create a 4-digit passcode"
                    className="w-full bg-transparent py-4 text-xl font-medium tracking-[.25em] outline-none placeholder:text-base placeholder:tracking-normal placeholder:text-white/25"
                  />
                </div>
              )}
              <button
                disabled={
                  !name.trim() || (profilePinEnabled && profilePin.length !== 4)
                }
                onClick={next}
                className="reelos-play mt-8 rounded-full bg-[#f0ba61] px-6 py-3.5 text-sm font-bold text-[#211507] disabled:cursor-not-allowed disabled:opacity-35"
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
                <div className="mt-8 flex gap-3 border-b border-white/25">
                  <input
                    autoFocus
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && memberName.trim()) {
                        setMembers((items) => [...items, memberName.trim()]);
                        setMemberName("");
                        setAddingMember(false);
                      }
                    }}
                    placeholder="Their name"
                    className="min-w-0 flex-1 bg-transparent py-4 text-xl outline-none placeholder:text-white/25"
                  />
                  <button
                    disabled={!memberName.trim()}
                    onClick={() => {
                      setMembers((items) => [...items, memberName.trim()]);
                      setMemberName("");
                      setAddingMember(false);
                    }}
                    className="text-sm font-semibold text-[#eebd69] disabled:opacity-30"
                  >
                    Add
                  </button>
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
              <div className="mt-10 border-b border-white/25">
                <input
                  autoFocus
                  type="password"
                  value={torboxKey}
                  onChange={(event) => setTorboxKey(event.target.value)}
                  placeholder="TorBox API key"
                  className="w-full bg-transparent py-4 text-xl outline-none placeholder:text-white/25"
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
