import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAdminToken } from '@/lib/admin-auth';
import { attackStore } from '@/lib/attack-store';
import { rateLimiter } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = attackStore.getStats();
    const rateLimiterStats = rateLimiter.getStats();

    return NextResponse.json({
      security: stats,
      rateLimit: {
        totalUsers: rateLimiterStats.totalUsers,
        blockedUsers: rateLimiterStats.blockedUsers,
        blockedIPs: rateLimiterStats.blockedIPs,
        avgRequestsPerUser: rateLimiterStats.avgRequestsPerUser,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error.message },
      { status: 500 }
    );
  }
}
