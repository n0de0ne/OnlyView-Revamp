import zlib from "node:zlib";

export const isPdf = (bytes: Buffer) => bytes.subarray(0, 4).toString("latin1") === "%PDF";

/** The text of a PDF made by the app (pdf-lib): inflates the streams and decodes the strings drawn. */
export function pdfText(bytes: Buffer): string {
  const source = bytes.toString("latin1");
  let out = "";
  for (const m of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Buffer.from(m[1], "latin1");
    let data: string;
    try {
      data = zlib.inflateSync(raw).toString("latin1");
    } catch {
      data = m[1];
    }
    for (const hex of data.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(hex[1], "hex").toString("latin1") + " ";
    for (const lit of data.matchAll(/\((.*?)\)\s*Tj/g)) out += lit[1] + " ";
  }
  return out;
}
