import { NextRequest, NextResponse } from 'next/server';
import { COURSES_DATABASE } from '@/data/courses';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');
  if (!parentId) {
    return NextResponse.json({ error: 'Missing parentId' }, { status: 400 });
  }
  const nines = COURSES_DATABASE.filter((c: any) => c.parent_id === parentId);
  return NextResponse.json(nines);
}
