// Email Service — SDLC-7
const FROM = { email: 'noreply@sdlc.dev', name: 'AI SDLC Copilot' };

async function send(to: string, subject: string, html: string, retries = 3): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: FROM, subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });
      if (res.ok || res.status === 202) return;
      throw new Error(`SendGrid ${res.status}`);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 2 ** i * 1000));
    }
  }
}

export const sendWelcomeEmail = (email: string, name: string) =>
  send(email, 'Welcome to AI SDLC Copilot', `<h1>Welcome, ${name}!</h1><p>Your account is ready. <a href="${process.env.APP_URL}/dashboard">Go to dashboard</a>.</p>`);

export const sendReleaseApprovedEmail = (email: string, releaseName: string, approvedBy: string) =>
  send(email, `Release ${releaseName} approved`, `<h2>Release Approved</h2><p><strong>${releaseName}</strong> approved by ${approvedBy} and ready for deployment.</p>`);

export const sendHighRiskAlert = (email: string, prTitle: string, score: number) =>
  send(email, `⚠️ High Risk PR: ${prTitle}`, `<h2>High Risk PR</h2><p>"${prTitle}" scored ${score}/100. Review before merging.</p>`);
