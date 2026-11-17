"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, Check, Loader2, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectContextValue = {
  open: (plan?: string) => void;
};

const ConnectContext = createContext<ConnectContextValue | null>(null);

export function useConnect() {
  const ctx = useContext(ConnectContext);
  if (!ctx) throw new Error("useConnect must be used inside ConnectProvider");
  return ctx;
}

type Status = "idle" | "submitting" | "success" | "error";

const STEPS = [
  { number: "01", label: "Store details" },
  { number: "02", label: "Install connector" },
  { number: "03", label: "First scan" },
];

export function ConnectProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [plan, setPlan] = useState<string | undefined>();

  const open = useCallback((nextPlan?: string) => {
    setPlan(nextPlan);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ConnectContext.Provider value={value}>
      {children}
      <ConnectDialog open={isOpen} plan={plan} onClose={close} />
    </ConnectContext.Provider>
  );
}

function ConnectDialog({
  open,
  plan,
  onClose,
}: {
  open: boolean;
  plan?: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 40);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      const reset = window.setTimeout(() => {
        setStatus("idle");
        setError("");
      }, 250);
      return () => window.clearTimeout(reset);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const form = new FormData(event.currentTarget);
    const emailValue = String(form.get("email") ?? "").trim();
    let storeUrl = String(form.get("storeUrl") ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError("Enter a valid work email.");
      setStatus("error");
      return;
    }

    if (!/^https?:\/\//i.test(storeUrl)) {
      storeUrl = `https://${storeUrl}`;
    }

    try {
      const parsed = new URL(storeUrl);
      if (!parsed.hostname.includes(".")) throw new Error("Invalid host");
      storeUrl = parsed.origin;
    } catch {
      setError("Enter your store's domain, for example https://your-store.com.");
      setStatus("error");
      return;
    }

    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue,
          storeUrl,
          catalogSize: form.get("catalogSize"),
          plan: plan ?? "Solo",
          website: form.get("website"),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Something went wrong. Try again in a moment.");
      }

      setSubmittedEmail(emailValue);
      setStatus("success");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Try again in a moment.",
      );
      setStatus("error");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close connect dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-[3px]"
        tabIndex={-1}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        className={cn(
          "relative z-10 flex max-h-[94dvh] w-full max-w-[860px] flex-col overflow-y-auto",
          "rounded-t-2xl border border-white/12 bg-ink-2 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-2xl",
          "animate-rise",
        )}
      >
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="relative hidden overflow-hidden border-r border-white/8 bg-ink-3 p-8 lg:flex lg:flex-col lg:justify-between">
            <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
            <div className="pointer-events-none absolute -left-20 bottom-10 h-64 w-64 rounded-full bg-accent/25 blur-[90px]" />

            <div className="relative">
              <p className="eyebrow text-paper/40">Connect a store</p>
              <h2 className="display mt-5 text-[30px] text-paper">
                Your catalog,
                <br />
                mapped in four
                <br />
                minutes.
              </h2>
              <p className="mt-4 max-w-[240px] text-[13.5px] leading-relaxed text-paper/50">
                One connector, one key, one scan. Silo builds the invalidation graph before
                it serves a single cached page.
              </p>
            </div>

            <ol className="relative mt-10 space-y-5">
              {STEPS.map((step, index) => {
                const active = index === 0;
                return (
                  <li key={step.number} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md border font-mono text-[10px]",
                        active
                          ? "border-accent/50 bg-accent/15 text-accent-hi"
                          : "border-white/10 text-paper/30",
                      )}
                    >
                      {status === "success" && index === 0 ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        step.number
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[13px]",
                        active ? "text-paper/85" : "text-paper/35",
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <p className="relative mt-10 flex items-center gap-2 text-[11px] text-paper/35">
              <Lock className="h-3.5 w-3.5" />
              Store keys are scoped per store. Always.
            </p>
          </aside>

          <div className="relative p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow text-accent-hi">
                  {status === "success" ? "Request received" : "Start free trial"}
                </p>
                <h2 id="connect-title" className="display mt-3 text-[28px] text-paper sm:text-[32px]">
                  {status === "success" ? "Check your inbox." : "Connect your store."}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-paper/50 transition hover:border-white/20 hover:text-paper"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {status === "success" ? (
              <div className="mt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-mint/30 bg-mint/10">
                  <Check className="h-5 w-5 text-mint" />
                </div>
                <p className="mt-5 text-[14.5px] leading-relaxed text-paper/65">
                  We&apos;ll send your connector key and install guide to{" "}
                  <span className="font-medium text-paper">{submittedEmail}</span>. The key is
                  tied to one store and starts your 14-day trial when the connector first
                  syncs.
                </p>
                <div className="mt-6 space-y-3 rounded-xl border border-white/9 bg-white/[0.025] p-4">
                  <p className="mono-label uppercase">What happens next</p>
                  {[
                    "Download the Silo connector from the email.",
                    "Paste the key, then hit “Scan catalog”.",
                    "Watch the first invalidation event land in your dashboard.",
                  ].map((item, index) => (
                    <div key={item} className="flex gap-3 text-[13px] leading-relaxed text-paper/55">
                      <span className="mt-0.5 font-mono text-[10px] text-accent-hi">
                        0{index + 1}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={onClose} className="btn btn-secondary mt-6 w-full">
                  Back to the site
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="connect-email"
                      className="mb-1.5 block text-[12px] font-medium text-paper/60"
                    >
                      Work email
                    </label>
                    <input
                      ref={firstFieldRef}
                      id="connect-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@store.com"
                      className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="connect-url"
                      className="mb-1.5 block text-[12px] font-medium text-paper/60"
                    >
                      Store URL
                    </label>
                    <input
                      id="connect-url"
                      name="storeUrl"
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      required
                      placeholder="https://your-store.com"
                      className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 font-mono text-[13px] text-paper outline-none transition placeholder:font-sans placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
                    />
                    <p className="mt-1.5 text-[11px] text-paper/30">
                      The store where the connector will be installed.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="connect-size"
                        className="mb-1.5 block text-[12px] font-medium text-paper/60"
                      >
                        Catalog size
                      </label>
                      <select
                        id="connect-size"
                        name="catalogSize"
                        defaultValue="1k-10k"
                        className="h-11 w-full appearance-none rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[13px] text-paper/80 outline-none transition focus:border-accent/60"
                      >
                        <option value="under-1k" className="bg-ink-2">
                          Under 1,000 SKUs
                        </option>
                        <option value="1k-10k" className="bg-ink-2">
                          1,000–10,000 SKUs
                        </option>
                        <option value="10k-50k" className="bg-ink-2">
                          10,000–50,000 SKUs
                        </option>
                        <option value="50k-plus" className="bg-ink-2">
                          50,000+ SKUs
                        </option>
                      </select>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-[12px] font-medium text-paper/60">
                        Plan
                      </span>
                      <div className="flex h-11 items-center justify-between rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[13px] text-paper/80">
                        <span>{plan ?? "Solo"}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-paper/30">
                          trial
                        </span>
                      </div>
                    </div>
                  </div>

                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-rose/25 bg-rose/8 px-3 py-2.5 text-[12.5px] text-rose"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="btn btn-primary mt-5 w-full disabled:cursor-wait disabled:opacity-70"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reserving your key
                    </>
                  ) : (
                    <>
                      Start 14-day trial
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-[11px] leading-relaxed text-paper/30">
                  No card required. By continuing you agree to the{" "}
                  <a href="/terms" className="underline underline-offset-2 hover:text-paper/60">
                    terms
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="underline underline-offset-2 hover:text-paper/60">
                    privacy policy
                  </a>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
