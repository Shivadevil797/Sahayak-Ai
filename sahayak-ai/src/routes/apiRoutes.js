import { Router } from 'express';
import { directAnalysis } from '../controllers/analysisController.js';
import { registerSenior, listSeniors } from '../controllers/seniorController.js';
import {
  listReports,
  getReportStats,
  getReportById,
  deleteReport,
} from '../controllers/reportController.js';
import { validateAnalysisInput, validateSeniorRegistration } from '../middleware/validator.js';
import { analysisLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ── Scam Analysis ──
router.post('/analyze', analysisLimiter, validateAnalysisInput, directAnalysis);

// ── Scam Reports API ──
router.get('/reports', listReports);
router.get('/reports/stats', getReportStats);
router.get('/reports/:id', getReportById);
router.delete('/reports/:id', deleteReport);

// ── Senior Registration ──
router.post('/seniors', validateSeniorRegistration, registerSenior);
router.get('/seniors', listSeniors);

export default router;