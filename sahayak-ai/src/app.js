import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import mongoose from 'mongoose';
import apiRoutes from './routes/apiRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { securityHeaders } from './middleware/security.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/logger.js';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '../public');

const app = express();

// ── Trust Proxy (for accurate IP detection behind load balancers/proxies) ──
app.set('trust proxy', 1);

// ── Security & Hardening ──
app.use(securityHeaders);
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── HTTP Request Logger ──
app.use(requestLogger);

// ── Rate Limiting (General) ──
app.use(generalLimiter);

// ── Body Parsers ──
// Twilio sends urlencoded; Meta sends JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// ── Static Frontend Dashboard ──
app.use(express.static(publicPath));

// ── Health Check ──
app.get('/health', (_req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
  res.json({
    status: 'UP',
    service: 'Sahayak AI',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: {
      status: dbState,
      connected: mongoose.connection.readyState === 1,
    },
    version: '1.0.0',
  });
});

// ── Routes ──
app.use('/webhook', webhookRoutes); // GET + POST /webhook
app.use('/api/v1', apiRoutes);      // /analyze, /seniors, /reports

// ── Fallback for Single Page App Dashboard ──
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ── Error Handling Middleware ──
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;