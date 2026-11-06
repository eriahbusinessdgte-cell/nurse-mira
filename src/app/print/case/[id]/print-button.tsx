"use client";

export function PrintButton() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg bg-blue-50 p-3 text-sm print:hidden">
      <span className="flex-1">Use your browser&apos;s print window to print or choose “Save as PDF”.</span>
      <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white">
        Print / Save as PDF
      </button>
    </div>
  );
}
