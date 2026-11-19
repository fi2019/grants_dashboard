"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/types";

interface Props {
  id: string;
  stage: Stage;
  owner: string | null;
  notes: string;
  internalReviewDate: string | null;
  hasEvaluation: boolean;
}

export function DecisionPanel(props: Props) {
  const router = useRouter();
  const [stage, setStage] = useState(props.stage);
  const [owner, setOwner] = useState(props.owner ?? "");
  const [notes, setNotes] = useState(props.notes);
  const [review, setReview] = useState(props.internalReviewDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState("");
  const url = `/api/opportunities/${encodeURIComponent(props.id)}`;

  async function save(patch?: { stage: Stage }) {
    setStatus("Saving…");
    const body = {
      stage: patch?.stage ?? stage,
      owner: owner || null,
      notes,
      internalReviewDate: review ? new Date(`${review}T12:00:00Z`).toISOString() : null,
    };
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setStatus(res.ok ? "Saved" : `Error: ${(await res.json()).error}`);
    if (res.ok) router.refresh();
  }

  async function evaluate() {
    setStatus("Evaluating with Claude…");
    const res = await fetch(`${url}/evaluate`, { method: "POST" });
    setStatus(res.ok ? "Evaluation updated" : `Error: ${(await res.json()).error}`);
    if (res.ok) router.refresh();
  }

  function decide(s: Stage) {
    setStage(s);
    void save({ stage: s });
  }

  const input = "w-full rounded border border-slate-300 px-2 py-1.5 text-sm";
  return (
    <div className="sticky top-4 space-y-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-navy-900">Decision</h2>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => decide("go")} className="rounded bg-emerald-700 py-2 text-sm font-medium text-white">Go</button>
        <button onClick={() => decide("declined")} className="rounded bg-slate-600 py-2 text-sm font-medium text-white">No-go</button>
      </div>
      <label className="block text-xs text-slate-500">Stage
        <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={input}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="block text-xs text-slate-500">Forge internal deadline (default: 2 weeks before submission)
        <input type="date" value={review} onChange={(e) => setReview(e.target.value)} className={input} />
      </label>
      <label className="block text-xs text-slate-500">Owner
        <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who is leading this?" className={input} />
      </label>
      <label className="block text-xs text-slate-500">Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} className={input} placeholder="Partner conversations, reasons for the decision…" />
      </label>
      <button onClick={() => save()} className="w-full rounded bg-navy-800 py-2 text-sm font-medium text-white">Save</button>
      <button onClick={evaluate} className="w-full rounded border border-navy-700 py-2 text-sm text-navy-800">
        {props.hasEvaluation ? "Re-evaluate with Claude" : "Evaluate with Claude"}
      </button>
      {status && <p className="text-xs text-slate-500">{status}</p>}
    </div>
  );
}
