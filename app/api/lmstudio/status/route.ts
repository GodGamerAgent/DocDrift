import { NextResponse } from 'next/server';
import { checkLMStudioHealth } from '@/lib/lmstudio';
import { loadSettings } from '@/lib/settings';

// Without this, Next would prerender the status once at build time.
export const dynamic = 'force-dynamic';

// Checks the endpoint saved in Settings; it is never taken from the request,
// so this route can't be used to make the server fetch arbitrary URLs.
export async function GET() {
  const settings = loadSettings();
  const status = await checkLMStudioHealth(settings.lmStudioEndpoint, settings.model);
  return NextResponse.json(status);
}
