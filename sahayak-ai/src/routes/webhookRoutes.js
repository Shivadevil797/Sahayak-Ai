import { Router } from 'express';
import { verifyWebhook, handleInboundMessage } from '../controllers/webhookController.js';

const router = Router();

// Twilio / Meta webhook handshake
router.get('/', verifyWebhook);

// Inbound WhatsApp message processing
router.post('/', handleInboundMessage);

export default router;
