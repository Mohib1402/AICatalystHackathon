import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAdminToken } from '@/lib/admin-auth';
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

    const { blockedUsers, blockedIPs } = rateLimiter.getBlockedList();

    return NextResponse.json({
      blockedUsers,
      blockedIPs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch blocked users', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { action, userId, ip } = await request.json();

    if (action === 'unblock') {
      if (userId) {
        rateLimiter.unblockUser(userId);
      }
      if (ip) {
        rateLimiter.unblockIP(ip);
      }
      return NextResponse.json({ success: true, message: 'User/IP unblocked' });
    }

    if (action === 'block') {
      if (userId) {
        rateLimiter.blockUser(userId, 3600000); // 1 hour
      }
      if (ip) {
        rateLimiter.blockIP(ip, 3600000);
      }
      return NextResponse.json({ success: true, message: 'User/IP blocked' });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to manage user', details: error.message },
      { status: 500 }
    );
  }
}
