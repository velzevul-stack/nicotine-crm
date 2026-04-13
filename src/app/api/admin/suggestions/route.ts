import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api/service-error-response';
import {
  adminListFormatSuggestions,
  adminUpdateFormatSuggestion,
} from '@/services/admin/admin-suggestions.service';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await adminListFormatSuggestions(session.userId);
    return NextResponse.json(payload);
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await adminUpdateFormatSuggestion(session.userId, body);
    return NextResponse.json({ success: true, suggestion: result.suggestion });
  } catch (e) {
    return serviceErrorResponse(e, 'Internal server error');
  }
}
