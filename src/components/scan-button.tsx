"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScanButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "error">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setState("running");
    setMessage("Scanning sources and evaluating new opportunities. This can take a few minutes.");
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState("idle");
      setMessage(`${body.added} new, ${body.evaluated} evaluated${body.errors?.length ? `, ${body.errors.length} warnings` : ""}`);
      router.refresh();
    } catch (e) {
      setState("error");
      setMessage((e as Error).message);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className={`max-w-xs text-xs ${state === "error" ? "text-red-700" : "text-slate-500"}`}>{message}</span>}
      <button onClick={run} disabled={state === "running"} className="rounded bg-forge px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {state === "running" ? "Scanning…" : "Run scan"}
      </button>
    </div>
  );
}
