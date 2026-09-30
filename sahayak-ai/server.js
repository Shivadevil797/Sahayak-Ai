import 'dotenv/config';
import mongoose from 'mongoose';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';

const PORT = process.env.PORT || 3000;

// Catch unexpected crashes
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`[Sahayak AI] 🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`[Sahayak AI] 🛡️  Dashboard UI: http://localhost:${PORT}`);
    console.log(`[Sahayak AI] 📡 Reports API:  http://localhost:${PORT}/api/v1/reports`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`\n[Sahayak AI] ${signal} received. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[Sahayak AI] HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('[Sahayak AI] MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('[Sahayak AI] Error during DB close:', err);
        process.exit(1);
      }
    });

    // Force exit if not closed within 10 seconds
    setTimeout(() => {
      console.error('[Sahayak AI] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
});