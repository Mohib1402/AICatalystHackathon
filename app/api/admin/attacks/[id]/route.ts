import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAdminToken } from '@/lib/admin-auth';
import { attackStore } from '@/lib/attack-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractTokenFromRequest(request);
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const attack = attackStore.getAttackById(params.id);

    if (!attack) {
      return NextResponse.json(
        { error: 'Attack not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(attack);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch attack', details: error.message },
      { status: 500 }
    );
  }
}
