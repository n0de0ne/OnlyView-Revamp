import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ContractContent } from "./contract-content";

const NAVY = rgb(0.106, 0.286, 0.396); // #1B4965
const GOLD = rgb(0.788, 0.663, 0.384); // #C9A962
const INK = rgb(0.15, 0.15, 0.17);
const GREY = rgb(0.45, 0.45, 0.48);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const WIDTH = A4[0] - MARGIN * 2;

/** WinAnsi-safe text (StandardFonts can't encode every unicode char). */
function safe(s: string): string {
  return s
    .replace(/→/g, "->")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFFŒœ]/g, "");
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage(A4);
  ctx.y = A4[1] - MARGIN;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx);
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const probe = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(probe, size) > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw a paragraph supporting **bold** runs; returns nothing, advances y. */
function drawRich(ctx: Ctx, text: string, opts: { size?: number; indent?: number; color?: ReturnType<typeof rgb> } = {}) {
  const size = opts.size ?? 10;
  const indent = opts.indent ?? 0;
  const lineH = size * 1.45;
  // tokenize into (text, bold) runs
  const runs: Array<{ t: string; b: boolean }> = [];
  safe(text)
    .split(/(\*\*[^*]+\*\*)/)
    .forEach((part) => {
      if (!part) return;
      if (part.startsWith("**") && part.endsWith("**")) {
        runs.push({ t: part.slice(2, -2), b: true });
      } else {
        runs.push({ t: part, b: false });
      }
    });

  // flow runs word by word
  let x = MARGIN + indent;
  ensure(ctx, lineH);
  const maxX = MARGIN + WIDTH;
  for (const run of runs) {
    const font = run.b ? ctx.bold : ctx.font;
    for (const word of run.t.split(/\s+/).filter(Boolean)) {
      const wWidth = font.widthOfTextAtSize(word + " ", size);
      if (x + wWidth > maxX) {
        ctx.y -= lineH;
        ensure(ctx, lineH);
        x = MARGIN + indent;
      }
      ctx.page.drawText(word, {
        x,
        y: ctx.y,
        size,
        font,
        color: opts.color ?? INK,
      });
      x += wWidth;
    }
  }
  ctx.y -= lineH * 1.35;
}

export interface SignatureBlock {
  signaturePngDataUrl?: string | null;
  signerName?: string;
  signedAtLabel?: string;
  ownerName: string;
  labels: { owner: string; tenant: string; date: string };
  /** e-signature audit trail, printed once the contract is signed */
  certification?: {
    lang: "en" | "fr";
    signerName: string;
    signedAt: string; // full date + time label
    ip: string | null;
  };
}

const CERT_TEXT = {
  en: {
    title: "ELECTRONIC SIGNATURE CERTIFICATION",
    signedAt: "Document electronically signed on:",
    signatory: "Signatory:",
    ip: "IP address:",
    legal:
      "This document was signed electronically via onlyviewstbarth.com and constitutes a legally binding agreement under applicable electronic signature laws.",
  },
  fr: {
    title: "CERTIFICATION DE SIGNATURE ÉLECTRONIQUE",
    signedAt: "Document signé électroniquement le :",
    signatory: "Signataire :",
    ip: "Adresse IP :",
    legal:
      "Ce document a été signé électroniquement via onlyviewstbarth.com et constitue un accord juridiquement contraignant en vertu des lois applicables sur la signature électronique.",
  },
};

export async function renderContractPdf(
  content: ContractContent,
  signature: SignatureBlock
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${content.title} — Villa ONLY VIEW`);
  doc.setAuthor("Villa ONLY VIEW");
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const ctx: Ctx = { doc, page: doc.addPage(A4), y: A4[1] - MARGIN, font, bold };

  // Header
  const title = safe(content.title);
  const tw = bold.widthOfTextAtSize(title, 15);
  ctx.page.drawText(title, { x: (A4[0] - tw) / 2, y: ctx.y, size: 15, font: bold, color: INK });
  ctx.y -= 22;
  const sub = safe(content.subtitle);
  const sw = bold.widthOfTextAtSize(sub, 12);
  ctx.page.drawText(sub, { x: (A4[0] - sw) / 2, y: ctx.y, size: 12, font: bold, color: NAVY });
  ctx.y -= 10;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: A4[0] - MARGIN, y: ctx.y },
    thickness: 1.2,
    color: GOLD,
  });
  ctx.y -= 24;

  for (const p of content.intro) drawRich(ctx, p);

  for (const s of content.sections) {
    ensure(ctx, 40);
    ctx.y -= 4;
    ctx.page.drawText(safe(s.heading), {
      x: MARGIN,
      y: ctx.y,
      size: 11,
      font: bold,
      color: NAVY,
    });
    ctx.y -= 16;
    for (const p of s.paragraphs) drawRich(ctx, p);
    if (s.bullets) {
      for (const b of s.bullets) {
        drawRich(ctx, "•  " + b, { indent: 8 });
      }
    }
    if (s.table) {
      for (const [k, v] of s.table) {
        ensure(ctx, 16);
        ctx.page.drawText(safe(k), { x: MARGIN + 4, y: ctx.y, size: 9.5, font: bold, color: INK });
        const lines = wrap(safe(v), font, 9.5, WIDTH - 170);
        for (const line of lines) {
          ctx.page.drawText(line, { x: MARGIN + 170, y: ctx.y, size: 9.5, font, color: INK });
          ctx.y -= 14;
          ensure(ctx, 14);
        }
      }
      ctx.y -= 8;
    }
  }

  drawRich(ctx, content.dated, { size: 10 });

  // Signature area
  ensure(ctx, 150);
  ctx.y -= 16;
  const colW = WIDTH / 2 - 20;
  const leftX = MARGIN;
  const rightX = MARGIN + WIDTH / 2 + 20;
  const topY = ctx.y;

  // Owner column
  ctx.page.drawText(safe(signature.labels.owner), { x: leftX, y: topY, size: 10, font: bold, color: INK });
  ctx.page.drawText(safe(signature.ownerName), { x: leftX, y: topY - 16, size: 10, font, color: INK });
  ctx.page.drawLine({
    start: { x: leftX, y: topY - 70 },
    end: { x: leftX + colW, y: topY - 70 },
    thickness: 0.8,
    color: GREY,
  });

  // Tenant column
  ctx.page.drawText(safe(signature.labels.tenant), { x: rightX, y: topY, size: 10, font: bold, color: INK });
  if (signature.signerName) {
    ctx.page.drawText(safe(signature.signerName), { x: rightX, y: topY - 16, size: 10, font, color: INK });
  }
  if (signature.signaturePngDataUrl?.startsWith("data:image/png;base64,")) {
    try {
      const png = await doc.embedPng(
        Buffer.from(signature.signaturePngDataUrl.split(",")[1], "base64")
      );
      const dims = png.scaleToFit(colW, 46);
      ctx.page.drawImage(png, {
        x: rightX,
        y: topY - 68 + 2,
        width: dims.width,
        height: dims.height,
      });
    } catch {
      // unreadable signature image — leave the line empty
    }
  }
  ctx.page.drawLine({
    start: { x: rightX, y: topY - 70 },
    end: { x: rightX + colW, y: topY - 70 },
    thickness: 0.8,
    color: GREY,
  });
  if (signature.signedAtLabel) {
    ctx.page.drawText(safe(`${signature.labels.date}: ${signature.signedAtLabel}`), {
      x: rightX,
      y: topY - 86,
      size: 9,
      font,
      color: GREY,
    });
  }
  ctx.y = topY - 100;

  // E-signature certification box (audit trail), like the legacy signed PDF
  if (signature.certification) {
    const t = CERT_TEXT[signature.certification.lang];
    const legalLines = wrap(safe(t.legal), font, 8.5, WIDTH - 24);
    const boxH = 20 + 3 * 13 + legalLines.length * 11 + 14;
    ensure(ctx, boxH + 10);
    ctx.y -= 10;
    const top = ctx.y;
    ctx.page.drawRectangle({
      x: MARGIN,
      y: top - boxH,
      width: WIDTH,
      height: boxH,
      borderColor: GOLD,
      borderWidth: 0.8,
      color: rgb(0.985, 0.975, 0.95),
    });
    let y = top - 14;
    ctx.page.drawText(safe(t.title), { x: MARGIN + 12, y, size: 9, font: bold, color: NAVY });
    y -= 15;
    const row = (label: string, value: string) => {
      ctx.page.drawText(safe(label), { x: MARGIN + 12, y, size: 8.5, font: bold, color: INK });
      ctx.page.drawText(safe(value), {
        x: MARGIN + 12 + bold.widthOfTextAtSize(safe(label), 8.5) + 6,
        y,
        size: 8.5,
        font,
        color: INK,
      });
      y -= 13;
    };
    row(t.signedAt, signature.certification.signedAt);
    row(t.signatory, signature.certification.signerName);
    row(t.ip, signature.certification.ip ?? "-");
    y -= 2;
    for (const line of legalLines) {
      ctx.page.drawText(line, { x: MARGIN + 12, y, size: 8.5, font, color: GREY });
      y -= 11;
    }
    ctx.y = top - boxH;
  }

  // Footer on each page
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawText(`Villa ONLY VIEW - Pointe Milou - Saint-Barthelemy`, {
      x: MARGIN,
      y: 30,
      size: 8,
      font,
      color: GREY,
    });
    page.drawText(`${i + 1} / ${pages.length}`, {
      x: A4[0] - MARGIN - 30,
      y: 30,
      size: 8,
      font,
      color: GREY,
    });
  });

  return doc.save();
}
