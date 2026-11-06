"use client";

// Turns a case study (or care plans) written in simple Markdown into a Word document.
// Supports headings (#..###), bullet and numbered lists, **bold**, and tables.

type Block = { title: string; content: string };

export async function markdownToDocx(docTitle: string, subtitle: string, blocks: Block[]): Promise<Blob> {
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } = d;

  const runs = (text: string, extra: { bold?: boolean } = {}) =>
    text
      .replace(/\s*\[S\d{1,2}\]/g, "")
      .split(/(\*\*[^*]+\*\*)/g)
      .filter(Boolean)
      .map((part) =>
        part.startsWith("**") && part.endsWith("**")
          ? new TextRun({ text: part.slice(2, -2), bold: true })
          : new TextRun({ text: part, bold: extra.bold, highlight: /\[MISSING/i.test(part) ? "yellow" : undefined }),
      );

  const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ text: docTitle, heading: HeadingLevel.TITLE }),
  ];
  if (subtitle) children.push(new Paragraph({ children: [new TextRun({ text: subtitle, italics: true, size: 20 })] }));

  blocks.forEach((b, bi) => {
    children.push(new Paragraph({ text: `${bi + 1}. ${b.title}`, heading: HeadingLevel.HEADING_1 }));
    const lines = b.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Table: consecutive lines starting with "|"
      if (/^\s*\|/.test(line)) {
        const rows: string[][] = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
          i++;
        }
        i--;
        const cols = Math.max(...rows.map((r) => r.length));
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows.map(
              (r, ri) =>
                new TableRow({
                  children: Array.from({ length: cols }, (_, ci) =>
                    new TableCell({
                      borders: { top: border, bottom: border, left: border, right: border },
                      children: [new Paragraph({ children: runs(r[ci] ?? "", { bold: ri === 0 }) })],
                    }),
                  ),
                }),
            ),
          }),
        );
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        children.push(new Paragraph({ children: runs(h[2], { bold: true }), heading: h[1].length <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 }));
        continue;
      }
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      if (bullet) {
        children.push(new Paragraph({ children: runs(bullet[1]), bullet: { level: /^\s{2,}/.test(line) ? 1 : 0 } }));
        continue;
      }
      const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (numbered) {
        children.push(new Paragraph({ children: [new TextRun({ text: `${numbered[1]}. ` }), ...runs(numbered[2])] }));
        continue;
      }
      children.push(new Paragraph({ children: runs(line) }));
    }
  });

  const doc = new Document({ creator: "Nurse Mira", title: docTitle, sections: [{ children }] });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
