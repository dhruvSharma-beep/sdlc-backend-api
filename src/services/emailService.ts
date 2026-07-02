import type { JobType } from '@prisma/client';

interface EmailPayload { to: string; subject: string; html: string; text: string; }
interface SendResult   { messageId?: string; }

const FROM = { email: process.env.SENDGRID_FROM_EMAIL ?? 'noreply@acme.dev', name: 'Acme Platform' };

async function send(payload: EmailPayload, attempt = 1): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error('SENDGRID_API_KEY not configured');

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from: FROM, subject: payload.subject,
      content: [
        { type: 'text/plain', value: payload.text },
        { type: 'text/html',  value: payload.html },
      ],
    }),
  });

  if (res.ok || res.status === 202) return { messageId: res.headers.get('x-message-id') ?? undefined };

  if ([429, 503].includes(res.status) && attempt <= 3) {
    await new Promise(r => setTimeout(r, 2 ** attempt * 1000));
    return send(payload, attempt + 1);
  }

  const body = await res.text();
  throw new Error(`SendGrid ${res.status}: ${body.substring(0, 200)}`);
}

// ── Email templates ───────────────────────────────────────────────────────────
const layout = (content: string) => `
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc}
.wrap{max-width:560px;margin:40px auto}.hdr{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;border-radius:12px 12px 0 0}
.hdr h1{margin:0;color:#fff;font-size:18px;font-weight:600}.body{background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none}
.btn{display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}
.muted{color:#64748b;font-size:13px}</style></head>
<body><div class="wrap"><div class="hdr"><h1>Acme Platform</h1></div><div class="body">${content}</div></div></body></html>`;

export async function sendWelcomeEmail(to: string, name: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return send({
    to, subject: `Welcome to Acme Platform, ${name.split(' ')[0]}!`,
    html: layout(`<h2 style="margin-top:0">You're in 🎉</h2><p>Your account is set up and ready. Connect your GitHub and Jira integrations to get started.</p><p><a href="${appUrl}/settings" class="btn">Set up integrations</a></p><p class="muted">You can always find us at ${appUrl}.</p>`),
    text: `Welcome to Acme Platform, ${name}! Set up your integrations at ${appUrl}/settings`,
  });
}

export async function sendReleaseApprovedEmail(to: string, releaseName: string, approvedBy: string, releaseId: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/releases/${releaseId}`;
  return send({
    to, subject: `✅ Release ${releaseName} approved`,
    html: layout(`<h2 style="margin-top:0">Release approved</h2><p><strong>${releaseName}</strong> was approved by <strong>${approvedBy}</strong> and is ready for deployment.</p><p><a href="${url}" class="btn">View release</a></p>`),
    text: `${releaseName} approved by ${approvedBy}. Deploy at: ${url}`,
  });
}

export async function sendHighRiskAlert(to: string, prTitle: string, score: number, prId: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/prs/${prId}`;
  return send({
    to, subject: `⚠️ High-risk PR needs review: ${prTitle.substring(0, 60)}`,
    html: layout(`<h2 style="margin-top:0;color:#dc2626">High-risk PR detected</h2><p>"<strong>${prTitle}</strong>" scored <strong style="color:#dc2626">${score}/100</strong> in the AI risk analysis.</p><p>Review it before merging to prevent potential issues in production.</p><p><a href="${url}" class="btn">Review PR</a></p>`),
    text: `High risk PR (${score}/100): "${prTitle}". Review at: ${url}`,
  });
}