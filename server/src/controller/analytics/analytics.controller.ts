import { Request, Response } from "express";
import { recordPageViewService, getVisitorStatsService } from "../../services/analytics/analytics.service";
import { getPerformanceSnapshot } from "../../utils/performance-metrics";
import { getCacheStats } from "../../utils/cache";

// PUBLIC — no auth required; fire-and-forget from the client website
export const trackPageView = async (req: Request, res: Response) => {
  try {
    const { path, sessionId } = req.body;
    if (path && sessionId) {
      await recordPageViewService(String(path).slice(0, 500), String(sessionId).slice(0, 100));
    }
  } catch {
    // intentionally swallow — never block visitors
  }
  res.status(200).json({ success: true });
};

// ADMIN — requires ADMIN JWT
export const getVisitorStats = async (_req: Request, res: Response) => {
  try {
    const stats = await getVisitorStatsService();
    res.setHeader("Cache-Control", "private, max-age=20");
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch visitor stats" });
  }
};

// PUBLIC — returns only the total page-view count (no auth required)
export const getPublicTotalVisits = async (_req: Request, res: Response) => {
  try {
    const stats = await getVisitorStatsService();
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({ success: true, data: { total: stats.pageViews.total } });
  } catch {
    res.status(200).json({ success: true, data: { total: 0 } });
  }
};

export const getPerformanceStats = async (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        api: getPerformanceSnapshot(),
        cache: getCacheStats(),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch performance stats" });
  }
};
