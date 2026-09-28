import variables from "./variables.json" with { type: "json" };

// Every email the app sends, as { subject, html, text }. One layout (table-based,
// inline styles -- what email clients actually render), brand colours from the
// app's light palette (mobile/_app/funcs/theme/palette.ts).

const SITE = variables.site.home;
const SUPPORT_EMAIL = variables.site.support_email;
const LOGO = `${SITE}/favicon-192x192.png`;

const C = {
  bg: "#F7F2EE",
  card: "#FFFFFF",
  text: "#221E1B",
  textSecondary: "#6C625B",
  textTertiary: "#9C9089",
  border: "#E7DFD8",
  primary: "#E24862",
  primarySoft: "#FBE7EC",
  success: "#2E9E5B",
  warning: "#DE8A34",
  danger: "#E14848",
  info: "#3B87CF",
};

/** @typedef {"success" | "info" | "warning" | "error"} Tone */
/** @type {Record<Tone, string>} */
const TONE_COLOR = {
  success: C.success,
  info: C.info,
  warning: C.warning,
  error: C.danger,
};

/** @param {unknown} s */
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      /** @type {Record<string, string>} */ ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );

/**
 * @typedef {{
 *   preheader: string;
 *   title: string;
 *   paragraphs: string[];
 *   code?: string;
 *   rows?: [string, string][];
 *   cta?: { label: string; url: string };
 *   tone?: Tone;
 *   footnote?: string;
 * }} Layout
 * Plain strings in, escaped here -- callers never build HTML themselves.
 */

/** @param {Layout} l */
function render(l) {
  const accent = l.tone ? TONE_COLOR[l.tone] : C.primary;
  const paragraphs = l.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${C.textSecondary};">${esc(p)}</p>`,
    )
    .join("");
  const code = l.code
    ? `<div style="margin:8px 0 22px;padding:18px 0;background:${C.primarySoft};border-radius:14px;text-align:center;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:${C.text};">${esc(l.code)}</div>`
    : "";
  const rows = l.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;border:1px solid ${C.border};border-radius:14px;border-collapse:separate;">${l.rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:12px 16px;font-size:14px;color:${C.textTertiary};${i ? `border-top:1px solid ${C.border};` : ""}">${esc(k)}</td><td align="right" style="padding:12px 16px;font-size:14px;font-weight:600;color:${C.text};${i ? `border-top:1px solid ${C.border};` : ""}">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const cta = l.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="border-radius:999px;background:${C.primary};"><a href="${esc(l.cta.url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(l.cta.label)}</a></td></tr></table>`
    : "";
  const footnote = l.footnote
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:20px;color:${C.textTertiary};">${esc(l.footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(l.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 18px;"><a href="${SITE}" style="text-decoration:none;"><img src="${LOGO}" width="36" height="36" alt="" style="vertical-align:middle;border-radius:9px;border:0;"><span style="vertical-align:middle;margin-left:10px;font-size:18px;font-weight:800;color:${C.text};">SuyoApp</span></a></td></tr>
<tr><td style="background:${C.card};border-radius:20px;border-top:4px solid ${accent};padding:32px 28px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:800;color:${C.text};">${esc(l.title)}</h1>
${paragraphs}${code}${rows}${cta}${footnote}
</td></tr>
<tr><td style="padding:20px 8px 0;text-align:center;font-size:12px;line-height:18px;color:${C.textTertiary};">
Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${C.textSecondary};">${SUPPORT_EMAIL}</a><br>
You can turn off activity emails in the app under Settings &rsaquo; Notifications.<br>
&copy; ${new Date().getFullYear()} SuyoApp
</td></tr>
</table></td></tr></table>
</body></html>`;
}

/** @param {Layout} l */
function toText(l) {
  return [
    l.title,
    "",
    ...l.paragraphs,
    ...(l.code ? ["", l.code, ""] : []),
    ...(l.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(l.cta ? ["", `${l.cta.label}: ${l.cta.url}`] : []),
    ...(l.footnote ? ["", l.footnote] : []),
    "",
    `Questions? ${SUPPORT_EMAIL}`,
    "SuyoApp",
  ].join("\n");
}

/**
 * @param {string} subject
 * @param {Layout} layout
 */
const email = (subject, layout) => ({
  subject,
  html: render(layout),
  text: toText(layout),
});

const openApp = { label: "Open SuyoApp", url: SITE };

export const emailTemplates = {
  /** @param {{ code: string | number; minutes: number; purpose: "login" | "email_change" }} v */
  verificationCode: (v) =>
    email(`${v.code} is your SuyoApp code`, {
      preheader: `Your code expires in ${v.minutes} minutes.`,
      title:
        v.purpose === "login" ? "Your sign-in code" : "Confirm your new email",
      paragraphs: [
        v.purpose === "login"
          ? "Enter this code in the app to sign in."
          : "Enter this code in the app to make this your SuyoApp email address.",
      ],
      code: String(v.code),
      footnote: `It expires in ${v.minutes} minutes. Never share it — SuyoApp will never ask you for it. If you didn't request this, you can ignore this email.`,
    }),

  /** @param {{ newEmail: string }} v */
  emailChangedOld: (v) =>
    email("Your SuyoApp email was changed", {
      preheader: "Your account email address was just changed.",
      title: "Your email was changed",
      tone: "warning",
      paragraphs: [
        `Your SuyoApp account email was changed to ${v.newEmail}. You won't get emails at this address anymore.`,
      ],
      footnote: `If you didn't make this change, contact ${SUPPORT_EMAIL} right away.`,
    }),

  emailChangedNew: () =>
    email("Your email is confirmed", {
      preheader: "You'll get account emails and receipts here.",
      title: "Your email is confirmed",
      tone: "success",
      paragraphs: [
        "This is now the email address on your SuyoApp account. We'll send your receipts, security alerts and (if you want them) new match updates here.",
      ],
      cta: openApp,
    }),

  /** @param {{ lastDigits: string }} v */
  phoneChanged: (v) =>
    email("Your SuyoApp phone number was changed", {
      preheader: "Your sign-in phone number was just changed.",
      title: "Your phone number was changed",
      tone: "warning",
      paragraphs: [
        `The phone number you sign in with was changed to a number ending in ${v.lastDigits}.`,
      ],
      footnote: `If you didn't make this change, contact ${SUPPORT_EMAIL} right away.`,
    }),

  /** @param {{ name: string }} v */
  accountDeleted: (v) =>
    email("Your SuyoApp account was deleted", {
      preheader: "Sorry to see you go.",
      title: "Your account was deleted",
      paragraphs: [
        `${v.name ? `${v.name}, your` : "Your"} SuyoApp account has been deleted and your profile is no longer shown to anyone.`,
        "Any web subscription was cancelled, so you won't be charged again. Plans bought in the App Store or Google Play have to be cancelled in the store.",
      ],
      footnote: `If you didn't delete your account, contact ${SUPPORT_EMAIL}.`,
    }),

  verificationApproved: () =>
    email("You're verified on SuyoApp", {
      preheader: "Your profile now has the verified badge.",
      title: "You're verified!",
      tone: "success",
      paragraphs: [
        "Your selfie checked out — your profile now shows the verified badge, so people know you're really you.",
      ],
      cta: openApp,
    }),

  /** @param {{ reason: string }} v */
  verificationRejected: (v) =>
    email("We couldn't verify your selfie", {
      preheader: "You can try again anytime.",
      title: "We couldn't verify your selfie",
      tone: "warning",
      paragraphs: [
        v.reason || "Your selfie didn't pass our check.",
        "You can take a new one anytime from your profile.",
      ],
      cta: { label: "Try again", url: SITE },
    }),

  /** @param {{ isSuperlike: boolean }} v */
  newLike: (v) =>
    email(v.isSuperlike ? "Someone sent you a rose" : "Someone likes you", {
      preheader: "See who it is in the app.",
      title: v.isSuperlike ? "Someone sent you a rose" : "Someone likes you",
      paragraphs: [
        v.isSuperlike
          ? "You caught someone's eye — they sent you a rose. Open your Likes to see who."
          : "You have a new like waiting. Open your Likes to see who it is — like them back and it's a match.",
      ],
      cta: { label: "See your likes", url: SITE },
    }),

  /** @param {{ name: string }} v */
  newMatch: (v) =>
    email(`It's a match with ${v.name || "someone new"}!`, {
      preheader: "Say hi while it's fresh.",
      title: "It's a match!",
      tone: "success",
      paragraphs: [
        `You and ${v.name || "someone"} liked each other. Say hi while it's fresh.`,
      ],
      cta: { label: "Start chatting", url: SITE },
    }),

  /** @param {{ name: string }} v */
  newMessage: (v) =>
    email(`New message from ${v.name || "your match"}`, {
      preheader: "Reply in the app.",
      title: `${v.name || "Your match"} sent you a message`,
      paragraphs: ["Open the app to read it and reply."],
      cta: { label: "Read message", url: SITE },
    }),

  /**
   * A payment/subscription event, worded by paymentNotices.js. With `rows` it
   * carries the payment details: a receipt, a failed-payment record or a refund.
   * @param {{ title: string; body: string; tone: Tone; record?: "paid" | "failed" | "refund"; rows?: [string, string][] }} v
   */
  payment: (v) =>
    email(
      v.rows && v.record === "paid"
        ? `Receipt: ${v.title}`
        : v.rows && v.record === "refund"
          ? `Refund receipt: ${v.title}`
          : v.title,
      {
        preheader: v.body,
        title: v.title,
        tone: v.tone,
        paragraphs: [v.body],
        rows: v.rows,
        cta:
          v.record === "failed"
            ? { label: "Update payment", url: SITE }
            : undefined,
        footnote: !v.rows
          ? undefined
          : v.record === "failed"
            ? "No money was taken for this payment. Keep this email for your records."
            : "Keep this email for your records.",
      },
    ),
};
