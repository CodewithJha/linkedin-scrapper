import nodemailer from 'nodemailer';
import path from 'path';

export function buildTransport(emailConfig) {
  const { smtpHost, smtpPort, smtpUser, smtpPass } = emailConfig;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
  });
}

export async function sendResults(emailConfig, filePath, meta = {}) {
  const transport = buildTransport(emailConfig);
  const subject = `LinkedIn scrape — ${new Date().toISOString()}`;
  const fileName = path.basename(filePath);

  const text = [
    'LinkedIn session completed.',
    meta.keywords ? `Keywords: ${meta.keywords}` : null,
    meta.location ? `Location: ${meta.location}` : null,
    meta.count !== undefined ? `Jobs: ${meta.count}` : null
  ]
    .filter(Boolean)
    .join('\n');

  await transport.sendMail({
    from: emailConfig.from,
    to: emailConfig.to,
    subject,
    text,
    attachments: [
      {
        filename: fileName,
        path: filePath
      }
    ]
  });
}
