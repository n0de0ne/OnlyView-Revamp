import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "./db";

export interface MailInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  templateSlug?: string;
  reservationId?: number;
  clientId?: number;
}

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Send an email via SMTP when configured; otherwise queue it in EmailLog so
 * nothing is silently lost (the admin can read queued mail in the log).
 */
export async function sendMail(input: MailInput): Promise<{ sent: boolean }> {
  const wrapped = wrapEmail(input.subject, input.html);

  if (!smtpConfigured()) {
    await prisma.emailLog.create({
      data: {
        templateSlug: input.templateSlug,
        recipientEmail: input.to,
        recipientName: input.toName,
        subject: input.subject,
        body: wrapped,
        reservationId: input.reservationId,
        clientId: input.clientId,
        status: "queued",
        errorMessage: "SMTP not configured — email stored, not sent",
      },
    });
    return { sent: false };
  }

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_PORT === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: `"${process.env.SMTP_FROM_NAME ?? "Villa ONLY VIEW"}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
      to: input.toName ? `"${input.toName}" <${input.to}>` : input.to,
      subject: input.subject,
      html: wrapped,
    });
    await prisma.emailLog.create({
      data: {
        templateSlug: input.templateSlug,
        recipientEmail: input.to,
        recipientName: input.toName,
        subject: input.subject,
        reservationId: input.reservationId,
        clientId: input.clientId,
        status: "sent",
      },
    });
    return { sent: true };
  } catch (e) {
    await prisma.emailLog.create({
      data: {
        templateSlug: input.templateSlug,
        recipientEmail: input.to,
        recipientName: input.toName,
        subject: input.subject,
        body: wrapped,
        reservationId: input.reservationId,
        clientId: input.clientId,
        status: "failed",
        errorMessage: e instanceof Error ? e.message : String(e),
      },
    });
    return { sent: false };
  }
}

function wrapEmail(subject: string, content: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f2ee;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;padding:24px 0;">
      <div style="font-size:22px;letter-spacing:0.35em;color:#1B4965;">ONLY&nbsp;VIEW</div>
      <div style="font-size:11px;letter-spacing:0.3em;color:#C9A962;margin-top:4px;">SAINT-BARTHÉLEMY</div>
    </div>
    <div style="background:#ffffff;border-radius:12px;padding:32px;color:#333;line-height:1.6;font-size:15px;">
      ${content}
    </div>
    <div style="text-align:center;padding:24px 0;color:#8a8a8a;font-size:12px;">
      Villa ONLY VIEW · Pointe Milou · 97133 Saint-Barthélemy<br>
      <a href="https://onlyviewstbarth.com" style="color:#C9A962;">onlyviewstbarth.com</a>
    </div>
  </div>
</body></html>`;
}
