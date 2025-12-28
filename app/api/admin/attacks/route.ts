import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAdminToken } from '@/lib/admin-auth';
import { attackStore } from '@/lib/attack-store';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const blocked = searchParams.get('blocked') === 'true' ? true : 
                    searchParams.get('blocked') === 'false' ? false : undefined;
    const minRiskScore = searchParams.get('minRiskScore') 
      ? parseInt(searchParams.get('minRiskScore')!)
      : undefined;

    const result = attackStore.getAttacks({
      limit,
      offset,
      blocked,
      minRiskScore,
    });

    return NextResponse.json({
      attacks: result.attacks,
      total: result.total,
      limit,
      offset,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch attacks', details: error.message },
      { status: 500 }
    );
  }
}
