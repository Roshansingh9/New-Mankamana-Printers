import prisma from "../../connect";
import { withCache } from "../../utils/cache";

export const recordPageViewService = async (path: string, sessionId: string) => {
  return prisma.pageView.create({ data: { path, sessionId } });
};

export const getVisitorStatsService = async () => {
  return withCache("analytics:visitor-stats", 20_000, async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const onlineThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 min = "online"

    const [totalViews, todayViews, weekViews, monthViews] = await Promise.all([
      prisma.pageView.count(),
      prisma.pageView.count({ where: { visitedAt: { gte: todayStart } } }),
      prisma.pageView.count({ where: { visitedAt: { gte: weekStart } } }),
      prisma.pageView.count({ where: { visitedAt: { gte: monthStart } } }),
    ]);

    const [uniqueAllRows, uniqueTodayRows, onlineRows] = await Promise.all([
      prisma.pageView.findMany({ distinct: ["sessionId"], select: { sessionId: true } }),
      prisma.pageView.findMany({
        where: { visitedAt: { gte: todayStart } },
        distinct: ["sessionId"],
        select: { sessionId: true },
      }),
      prisma.pageView.findMany({
        where: { visitedAt: { gte: onlineThreshold } },
        distinct: ["sessionId"],
        select: { sessionId: true },
      }),
    ]);

    return {
      pageViews: {
        total: totalViews,
        today: todayViews,
        thisWeek: weekViews,
        thisMonth: monthViews,
      },
      uniqueVisitors: {
        total: uniqueAllRows.length,
        today: uniqueTodayRows.length,
      },
      currentlyOnline: onlineRows.length,
    };
  });
};
