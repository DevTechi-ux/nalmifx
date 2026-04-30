// Support auto-reply bot.
// Generates a structured first-touch response for new tickets and unassigned
// follow-ups, based on the ticket's priority, category, and message content.

const BOT_NAME = 'NALMI-FX Team'

// Priority -> SLA acknowledgement
const PRIORITY_ACK = {
  URGENT: {
    eta: 'within 1 hour',
    line: "We've flagged this as URGENT and routed it to our senior support team. A specialist is being notified right now.",
  },
  HIGH: {
    eta: 'within 2–4 hours',
    line: "This has been marked as HIGH priority. A support specialist will get back to you shortly.",
  },
  MEDIUM: {
    eta: 'within 12–24 hours',
    line: "Thanks for reaching out. Your ticket is in the queue and a team member will respond soon.",
  },
  LOW: {
    eta: 'within 1–2 business days',
    line: "Thanks for your message. We've logged your ticket and will respond as soon as we can.",
  },
}

// Category -> targeted self-help guidance
const CATEGORY_GUIDE = {
  DEPOSIT: [
    "While you wait, a few things you can check:",
    "• Bank/UPI deposits typically clear in 5–30 minutes; crypto deposits clear after the required network confirmations.",
    "• Make sure the transfer was sent to the exact deposit address/UPI shown in your wallet at the time of the request.",
    "• If you uploaded a payment screenshot, our team will verify and credit it once confirmed on chain or by your bank.",
  ],
  WITHDRAWAL: [
    "A few quick checks while a specialist reviews your case:",
    "• Withdrawals require a fully completed KYC. You can verify your status under Profile → KYC.",
    "• Bank withdrawals are processed in business hours and usually settle within 24 hours.",
    "• Crypto withdrawals are sent on-chain after a brief security review — please double-check the network and address you submitted.",
  ],
  TRADING: [
    "Some quick references that might help in the meantime:",
    "• Open positions, leverage, and margin status are visible under each trading account.",
    "• Stop-loss and take-profit can be edited from the open-positions panel.",
    "• Markets close on weekends for forex and stock symbols — crypto trades 24/7.",
  ],
  ACCOUNT: [
    "While we look into this:",
    "• If you can't sign in, try the password reset flow from the login page.",
    "• KYC documents must be clear and unedited — blurry uploads are the #1 cause of rejection.",
    "• You can update your phone, email, or password under Profile → Settings.",
  ],
  TECHNICAL: [
    "Some common fixes that resolve most technical issues:",
    "• Force-quit and reopen the app, or hard-refresh the web browser (Ctrl/Cmd+Shift+R).",
    "• Make sure you're on the latest app version from the Play Store.",
    "• If charts or prices stall, switch network (Wi-Fi ↔ mobile data) and retry.",
    "• Sharing a screenshot of any error message helps us diagnose faster.",
  ],
  GENERAL: [],
  OTHER: [],
}

// Keyword groups that override / augment category guidance.
// First match wins. Each entry: { match: RegExp, label, lines }.
const KEYWORD_INTENTS = [
  {
    match: /\b(reset|forgot|forgotten)\s+(my\s+)?password|can'?t\s+(log|sign)\s*in|locked\s+out\b/i,
    label: 'Password / sign-in',
    lines: [
      "Looks like you're having trouble signing in. The fastest path is the password reset on the login page — it sends a reset link to your registered email.",
      "If the email doesn't arrive within 5 minutes, please check your spam folder and confirm you're entering the correct address.",
    ],
  },
  {
    match: /\b(kyc|verify|verification|verified|document|aadhaar|pan|passport|id\s+proof)\b/i,
    label: 'KYC / verification',
    lines: [
      "For KYC, we need a clear, unedited photo of a government-issued ID and a live selfie. Most rejections are because the document is blurry, cropped, or expired.",
      "After resubmitting, verification usually completes within a few hours during business days.",
    ],
  },
  {
    match: /\b(deposit|fund(ing)?\s+account|money\s+(sent|not\s+received)|paid\s+but)\b/i,
    label: 'Deposit',
    lines: [
      "Deposits typically clear within minutes (UPI/bank) or after the required network confirmations (crypto). If your transfer is older than 30 minutes and still pending, please share the transaction reference / TXID and the exact amount sent.",
    ],
  },
  {
    match: /\b(withdraw(al)?|payout|cash\s*out)\b/i,
    label: 'Withdrawal',
    lines: [
      "Withdrawal requests are reviewed and processed in batches. KYC must be complete and your bank/wallet details verified before payout.",
    ],
  },
  {
    match: /\b(2fa|two[-\s]?factor|authenticator|otp\s+not)\b/i,
    label: '2FA',
    lines: [
      "If you're locked out of 2FA, please open a ticket from a verified email with proof of identity attached so we can safely reset your authenticator.",
    ],
  },
  {
    match: /\b(stop[-\s]?loss|take[-\s]?profit|leverage|margin\s+call|liquidat(ed|ion))\b/i,
    label: 'Position / risk',
    lines: [
      "Stop-loss / take-profit can be edited from the open-positions panel. Margin levels and liquidation prices update live — make sure your free margin stays positive to avoid forced closes.",
    ],
  },
  {
    match: /\b(refer(r|al)|ib\s+|introducing\s+broker|commission)\b/i,
    label: 'IB / referrals',
    lines: [
      "IB earnings and referral links are managed under the IB section. Commissions accrue daily and pay out per the schedule shown on your IB dashboard.",
    ],
  },
  {
    match: /\b(copy[-\s]?trad|follow(er|ing)\s+a\s+trader|signal\s+provider)\b/i,
    label: 'Copy trading',
    lines: [
      "Copy-trading positions mirror the master account at a scaled size based on your allocation. You can pause or stop following at any time from the Copy Trading page.",
    ],
  },
  {
    match: /\b(challenge|prop|funded\s+account|drawdown|profit\s+target)\b/i,
    label: 'Prop / challenge',
    lines: [
      "Challenge progress, drawdown limits, and the active phase are visible on your Challenge Dashboard. Daily and overall drawdown reset/freeze at the times shown there.",
    ],
  },
]

const FOOTER = "— This is an automated first response from our AI Support Assistant. A human team member will follow up if more help is needed."

const SAFE_TEXT = (s) => (typeof s === 'string' ? s : '').slice(0, 4000)

/**
 * Build an auto-reply for a ticket.
 * Returns null when there is nothing useful to say.
 */
export function generateAutoReply({ message, priority = 'MEDIUM', category = 'GENERAL', subject = '' } = {}) {
  const ack = PRIORITY_ACK[priority] || PRIORITY_ACK.MEDIUM
  const text = SAFE_TEXT(`${subject}\n${message}`)

  // Detect intent from message content
  const intent = KEYWORD_INTENTS.find((k) => k.match.test(text))

  // Build sections
  const parts = []
  parts.push(`Hi! ${ack.line}`)
  parts.push(`Estimated response time: ${ack.eta}.`)

  if (intent) {
    parts.push('') // blank line
    parts.push(...intent.lines)
  } else if (CATEGORY_GUIDE[category] && CATEGORY_GUIDE[category].length) {
    parts.push('') // blank line
    parts.push(...CATEGORY_GUIDE[category])
  }

  // Urgent footnote
  if (priority === 'URGENT') {
    parts.push('')
    parts.push("If this involves account safety (unauthorized access, missing funds), please also email security@nalmifx.com so we can act immediately.")
  }

  parts.push('')
  parts.push(FOOTER)

  return {
    botName: BOT_NAME,
    message: parts.join('\n'),
    intent: intent ? intent.label : null,
  }
}

export const SUPPORT_BOT_NAME = BOT_NAME
