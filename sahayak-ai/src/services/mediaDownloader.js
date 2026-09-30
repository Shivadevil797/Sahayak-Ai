import axios from 'axios';

/**
 * Download media from a URL (typically a Twilio MediaUrl).
 * Automatically applies Twilio Basic Auth if credentials are available.
 *
 * @param {string} mediaUrl - Fully qualified URL to the media resource
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export const downloadMedia = async (mediaUrl) => {
  const config = {
    responseType: 'arraybuffer',
    timeout: 30_000,
  };

  // Twilio-hosted media requires account credentials
  if (
    mediaUrl.includes('api.twilio.com') &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  ) {
    config.auth = {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN,
    };
  }

  console.log(`[Media] Downloading from ${mediaUrl.substring(0, 80)}...`);
  const { data, headers } = await axios.get(mediaUrl, config);

  return {
    buffer: Buffer.from(data),
    contentType: headers['content-type'] || 'application/octet-stream',
  };
};
