"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRight, Check, Copy, Loader2, AlertTriangle, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "details" | "key" | "install" | "verify";

export function CreateStoreForm() {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [storeId, setStoreId] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create store");
        setLoading(false);
        return;
      }

      setApiKey(data.apiKey);
      setStoreId(data.store.id);
      setStep("key");
    } catch {
      setError("Network error. Try again.");
    }
    setLoading(false);
  }

  async function copyKey() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copySaasUrl() {
    await navigator.clipboard.writeText(window.location.origin);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/stores/${storeId}`);
      const data = await res.json();
      if (data.store?.status === "optimized" || data.store?.status === "scanning") {
        setConnected(true);
      }
    } catch {
      // silent
    }
    setChecking(false);
  }, [storeId]);

  useEffect(() => {
    if (step !== "verify" || connected) return;
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [step, connected, checkConnection]);

  if (step === "key") {
    return (
      <div className="max-w-xl">
        <StepIndicator current={1} />
        <div className="mt-4 rounded-xl border border-mint/20 bg-mint/[0.04] p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint/15">
              <Check className="h-4 w-4 text-mint" />
            </div>
            <p className="text-[14px] font-medium text-paper/80">Store created</p>
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-medium text-paper/50">Your API key</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-[11px] text-paper/80 select-all">
                {apiKey}
              </code>
              <button
                type="button"
                onClick={copyKey}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-paper/50 transition hover:bg-white/5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-mint" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-medium text-paper/50">SaaS URL</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-[11px] text-paper/60">
                {typeof window !== "undefined" ? window.location.origin : ""}
              </code>
              <button
                type="button"
                onClick={copySaasUrl}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-paper/50 transition hover:bg-white/5"
              >
                {copiedUrl ? <Check className="h-3.5 w-3.5 text-mint" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/70" />
            <p className="text-[10px] leading-relaxed text-amber-300/60">
              Copy both values now — the API key won't be shown again. You'll paste them in the Silo connector settings in WordPress.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep("install")}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-accent/90"
          >
            I've copied the key
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "install") {
    return (
      <div className="max-w-xl">
        <StepIndicator current={2} />
        <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
          <p className="text-[14px] font-medium text-paper/80">Install the connector</p>

          <a
            href="/silo-connector.zip"
            download
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-[12px] font-medium text-accent transition hover:bg-accent/15"
          >
            <Download className="h-4 w-4" />
            Download silo-connector.zip
          </a>

          <ol className="mt-5 space-y-3">
            {[
              "In WordPress admin, go to Plugins → Add New → Upload Plugin.",
              "Upload the ZIP file and activate the plugin.",
              "Go to Settings → Silo in the WordPress admin menu.",
              "Paste your API key and SaaS URL, then click “Connect.”",
            ].map((text, i) => (
              <li key={text} className="flex gap-3 text-[12px] leading-relaxed text-paper/55">
                <span className="mt-0.5 font-mono text-[10px] text-accent/70">{String(i + 1).padStart(2, "0")}</span>
                {text}
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => {
              setStep("verify");
              checkConnection();
            }}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-accent/90"
          >
            I've installed and connected
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="max-w-xl">
        <StepIndicator current={3} />
        <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
          {connected ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint/15">
                  <Check className="h-5 w-5 text-mint" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-paper/80">Connected!</p>
                  <p className="mt-0.5 text-[11px] text-paper/40">
                    Your store is connected and Silo is optimizing your cache.
                  </p>
                </div>
              </div>
              <a
                href={`/dashboard/stores/${storeId}`}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-accent/90"
              >
                Go to store dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-accent/60" />
                <div>
                  <p className="text-[14px] font-medium text-paper/80">Waiting for connection...</p>
                  <p className="mt-0.5 text-[11px] text-paper/40">
                    Click "Connect" in your WordPress Silo settings. This page updates automatically.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={checkConnection}
                disabled={checking}
                className="mt-5 inline-flex items-center gap-1.5 text-[10px] text-paper/40 transition hover:text-paper/70"
              >
                <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
                Check now
              </button>

              <div className="mt-4 border-t border-white/6 pt-4">
                <a
                  href={`/dashboard/stores/${storeId}`}
                  className="text-[10px] text-paper/30 transition hover:text-paper/50"
                >
                  Skip — go to store dashboard
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="max-w-xl">
      <StepIndicator current={0} />
      <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <div className="space-y-4">
          <div>
            <label htmlFor="store-name" className="mb-1.5 block text-[12px] font-medium text-paper/60">
              Store name
            </label>
            <input
              id="store-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="My WooCommerce Store"
              className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
            />
          </div>
          <div>
            <label htmlFor="store-url" className="mb-1.5 block text-[12px] font-medium text-paper/60">
              Store URL
            </label>
            <input
              id="store-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://your-store.com"
              className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 font-mono text-[13px] text-paper outline-none transition placeholder:font-sans placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
            />
            <p className="mt-1.5 text-[10px] text-paper/30">
              The WooCommerce store where the connector will be installed.
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-[12px] text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim() || !url.trim()}
          className={cn(
            "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-accent/90",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Creating store...
            </>
          ) : (
            <>
              Create store & generate key
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function StepIndicator({ current }: { current: number }) {
  const steps = ["Store details", "API key", "Install plugin", "Verify"];

  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-medium transition",
              i < current && "bg-mint/10 text-mint/70",
              i === current && "bg-accent/15 text-accent",
              i > current && "text-paper/25",
            )}
          >
            {i < current ? (
              <Check className="h-2.5 w-2.5" />
            ) : (
              <span className="font-mono">{i + 1}</span>
            )}
            {label}
          </div>
          {i < steps.length - 1 && (
            <div className={cn("h-px w-4", i < current ? "bg-mint/20" : "bg-white/8")} />
          )}
        </div>
      ))}
    </div>
  );
}
