import { NextResponse } from 'next/server';
import { checkLMStudioHealth } from '@/lib/lmstudio';

// Without this, Next would prerender the status once at build time.
export const dynamic = 'force-dynamic';

// The endpoint is server-configured (LMSTUDIO_ENDPOINT) rather than a query param,
// so this route can't be used to make the server fetch arbitrary URLs.
export async function GET() {
  const status = await checkLMStudioHealth();
  return NextResponse.json(status);
}
