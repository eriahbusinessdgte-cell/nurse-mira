import type { ReactNode } from "react";
import type { FamilyPlan } from "@/lib/fncp/plan";

/** The printable seven-column table (landscape). Column headers repeat on every printed page. */
export function FncpTable({ title, plan, columns, printButton }: { title: string; plan: FamilyPlan; columns: string[][]; printButton?: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1400px] bg-white px-6 py-8 text-[11.5px] leading-snug text-black print:max-w-none print:p-0">
      <style>{`@page { size: A4 landscape; margin: 12mm; } @media print { html, body { background: #fff !important; } thead { display: table-header-group; } tr { break-inside: auto; } td { break-inside: auto; } }`}</style>
      {printButton}
      <h1 className="mb-2 text-center text-lg font-bold tracking-wide">{title}</h1>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {[13, 14, 15, 15, 17, 12, 14].map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map(([k, label]) => (
              <th key={k} className="border border-gray-500 bg-white px-1.5 text-black py-1.5 text-center font-bold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((r, i) => (
            <tr key={i} className="align-top">
              {columns.map(([k]) => (
                <td key={k} className="whitespace-pre-wrap break-words border border-gray-500 px-1.5 py-1.5">
                  {r[k as keyof typeof r]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
