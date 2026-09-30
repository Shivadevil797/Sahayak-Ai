import twilio from 'twilio';

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export const sendSeniorWhatsAppReply = async (seniorPhone, analysis) => {
  const icon = analysis.risk_level === 'SAFE' ? '✅' : '⚠️';
  const body = `${icon} *Sahayak AI Alert*\n\n${analysis.elder_friendly_explanation}\n\n👉 *Next Step:* ${analysis.immediate_action}`;

  if (!twilioClient) {
    console.log(`[Twilio Mock -> Senior ${seniorPhone}]:\n${body}`);
    return;
  }

  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: seniorPhone.startsWith('whatsapp:') ? seniorPhone : `whatsapp:${seniorPhone}`,
    body,
  });
};

export const sendCaregiverAlert = async (caregiverPhone, seniorUser, analysis, rawSnippet) => {
  const alertText = `🚨 *URGENT SAHAYAK ALERT for ${seniorUser.name}*\n\nRisk: ${analysis.risk_level} (${analysis.risk_score}/100)\nType: ${analysis.scam_category}\nSnippet: "${rawSnippet.substring(0, 80)}..."\n\nPlease check on them immediately!`;

  if (!twilioClient) {
    console.log(`[Twilio Mock -> Caregiver ${caregiverPhone}]:\n${alertText}`);
    return;
  }

  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: caregiverPhone.startsWith('whatsapp:') ? caregiverPhone : `whatsapp:${caregiverPhone}`,
    body: alertText,
  });
};