"use client";

import type { TypedSection } from "./typed-copy";

/** Builds a simple Word document from typed text (loaded only when needed). */
export async function makeDocx(
  title: string,
  sections: TypedSection[],
  opts: { note?: string; unit?: string } = {},
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            opts.note ??
            "Typed copy made by Nurse Mira from photographed notes. Reading mistakes are possible; [?] marks a word that couldn't be read. Drawings and colours from the original aren't included.",
          italics: true,
          size: 18,
        }),
      ],
    }),
  ];
  for (const s of sections) {
    if (s.page) children.push(new Paragraph({ text: `${opts.unit ?? "Page"} ${s.page}`, heading: HeadingLevel.HEADING_2 }));
    for (const line of s.text.split("\n")) {
      const clean = line.replace(/\*\*/g, "").replace(/^#+\s*/, "");
      const bullet = /^\s*[-*•★]\s+/.test(clean);
      children.push(
        new Paragraph({
          text: bullet ? clean.replace(/^\s*[-*•★]\s+/, "") : clean,
          bullet: bullet ? { level: 0 } : undefined,
        }),
      );
    }
  }
  const doc = new Document({ creator: "Nurse Mira", title, sections: [{ children }] });
  return Packer.toBlob(doc);
}
