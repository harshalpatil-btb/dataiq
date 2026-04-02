// dealiq/backend/src/services/notifications.js
import axios from 'axios'
import { resend, FROM_EMAIL, FROM_NAME } from '../lib/clients.js'

// Send Slack DM to a user
export async function sendSlackAlert({ user_id, message }) {
  if (!process.env.SLACK_BOT_TOKEN) return
  try {
    await axios.post('https://slack.com/api/chat.postMessage', {
      channel: user_id,
      text: message,
      unfurl_links: false,
    }, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    })
  } catch (err) {
    console.error('Slack alert failed:', err.message)
  }
}

// Send email alert to rep
export async function sendEmailAlert({ to, subject, body, deal }) {
  try {
    await resend.emails.send({
      from: `DealIQ Alerts <${FROM_EMAIL}>`,
      to,
      subject,
      html: body,
    })
  } catch (err) {
    console.error('Email alert failed:', err.message)
  }
}
