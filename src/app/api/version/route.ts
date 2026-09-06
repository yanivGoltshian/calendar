import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const revision = process.env.APP_REVISION;
  return NextResponse.json({
    revision: revision && /^[a-f0-9]{40}$/.test(revision) ? revision : 'development',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
