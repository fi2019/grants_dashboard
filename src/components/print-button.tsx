"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded bg-navy-800 px-4 py-2 text-sm text-white">
      Print / save as PDF
    </button>
  );
}
