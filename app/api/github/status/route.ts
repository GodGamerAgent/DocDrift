import { NextResponse } from 'next/server';
import { getGitHubStatus } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getGitHubStatus());
}
