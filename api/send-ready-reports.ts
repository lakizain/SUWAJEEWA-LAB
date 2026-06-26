import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    res.status(200).json({ message: "OK. Use POST to send emails." });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const gmailUser = (process.env.GMAIL_USER || "").trim();
  const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || "").trim();

  if (!gmailUser || !gmailAppPassword) {
    res.status(500).json({
      message: "Missing GMAIL_USER or GMAIL_APP_PASSWORD in server environment",
    });
    return;
  }

  const email = (req.body?.email || "").toString().trim();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!email || !isEmail(email)) {
    res.status(400).json({ message: "Invalid email" });
    return;
  }
  if (items.length === 0) {
    res.status(400).json({ message: "No tests selected" });
    return;
  }
  if (items.length > 50) {
    res.status(400).json({ message: "Too many items selected" });
    return;
  }

  const rows = items
    .map((it: any) => {
      const billNo = escapeHtml((it?.billNo ?? "").toString());
      const patientName = escapeHtml((it?.patientName ?? "").toString());
      const testName = escapeHtml((it?.testName ?? "").toString());
      return `<tr><td>${billNo}</td><td>${patientName}</td><td>${testName}</td></tr>`;
    })
    .join("");

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #111;">
      <h2 style="margin: 0 0 12px;">Ready Reports</h2>
      <div style="margin: 0 0 12px;">Selected tests:</div>
      <table cellspacing="0" cellpadding="8" style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <thead>
          <tr>
            <th align="left" style="border: 1px solid #ddd; background: #f7f7f7;">Bill No</th>
            <th align="left" style="border: 1px solid #ddd; background: #f7f7f7;">Patient</th>
            <th align="left" style="border: 1px solid #ddd; background: #f7f7f7;">Test</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  try {
    await transporter.sendMail({
      from: gmailUser,
      to: email,
      subject: "Ready Reports",
      html,
    });

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error: any) {
    const msg = (error?.message || "Failed to send email").toString();
    res.status(500).json({ message: msg });
  }
}
