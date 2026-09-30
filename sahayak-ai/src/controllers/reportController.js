import mongoose from 'mongoose';
import { ScamReport } from '../models/ScamReport.js';
import { User } from '../models/User.js';

/**
 * GET /api/v1/reports
 * Query params: page, limit, risk_level, scam_category, userId, search, startDate, endDate, sortBy, order
 */
export const listReports = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      risk_level,
      scam_category,
      userId,
      search,
      startDate,
      endDate,
      sortBy = 'timestamp',
      order = 'desc',
    } = req.query;

    const query = {};

    // Filter by risk level
    if (risk_level && risk_level.toUpperCase() !== 'ALL') {
      query.risk_level = risk_level.toUpperCase();
    }

    // Filter by scam category
    if (scam_category && scam_category.toUpperCase() !== 'ALL') {
      query.scam_category = scam_category.toUpperCase();
    }

    // Filter by user ID
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.user = new mongoose.Types.ObjectId(userId);
    }

    // Keyword search in raw_input or explanation
    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { raw_input: { $regex: sanitized, $options: 'i' } },
        { elder_friendly_explanation: { $regex: sanitized, $options: 'i' } },
        { immediate_action: { $regex: sanitized, $options: 'i' } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = order.toLowerCase() === 'asc' ? 1 : -1;

    const [reports, total] = await Promise.all([
      ScamReport.find(query)
        .populate('user', 'name phone_number caregiver_name caregiver_phone preferred_language')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ScamReport.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
      data: reports,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/stats
 * Aggregated statistics for the guardian dashboard
 */
export const getReportStats = async (_req, res, next) => {
  try {
    const totalReports = await ScamReport.countDocuments();
    const activeSeniors = await User.countDocuments({ is_active: true });

    // Aggregate by risk level
    const riskLevelStats = await ScamReport.aggregate([
      { $group: { _id: '$risk_level', count: { $sum: 1 }, avgScore: { $avg: '$risk_score' } } },
    ]);

    // Aggregate by scam category
    const categoryStats = await ScamReport.aggregate([
      { $group: { _id: '$scam_category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Aggregate by input channel
    const inputTypeStats = await ScamReport.aggregate([
      { $group: { _id: '$input_type', count: { $sum: 1 } } },
    ]);

    // Caregivers alerted
    const caregiversAlerted = await ScamReport.countDocuments({ alert_caregiver: true });

    // Average overall risk score
    const avgScoreResult = await ScamReport.aggregate([
      { $group: { _id: null, avgScore: { $avg: '$risk_score' } } },
    ]);
    const overallAvgScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgScore) : 0;

    // Time-based stats: Last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reportsLast24h = await ScamReport.countDocuments({ timestamp: { $gte: oneDayAgo } });

    // Formatted counts
    const byRisk = { CRITICAL: 0, SUSPICIOUS: 0, SAFE: 0 };
    riskLevelStats.forEach((r) => {
      if (r._id && byRisk[r._id] !== undefined) byRisk[r._id] = r.count;
    });

    const byCategory = {};
    categoryStats.forEach((c) => {
      byCategory[c._id || 'UNKNOWN'] = c.count;
    });

    const byInput = { TEXT: 0, IMAGE: 0, AUDIO: 0 };
    inputTypeStats.forEach((i) => {
      if (i._id && byInput[i._id] !== undefined) byInput[i._id] = i.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        totalReports,
        activeSeniors,
        caregiversAlerted,
        overallAvgScore,
        reportsLast24h,
        byRisk,
        byCategory,
        byInput,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/:id
 * Retrieve single scam report details
 */
export const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid report ID format' });
    }

    const report = await ScamReport.findById(id)
      .populate('user', 'name phone_number caregiver_name caregiver_phone preferred_language')
      .lean();

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/reports/:id
 * Delete a scam report (for admin moderation)
 */
export const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid report ID format' });
    }

    const deleted = await ScamReport.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    return res.status(200).json({ success: true, message: 'Report deleted successfully' });
  } catch (err) {
    next(err);
  }
};
