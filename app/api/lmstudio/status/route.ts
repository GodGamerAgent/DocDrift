import { NextResponse } from 'next/server';
import { checkLMStudioHealth } from '@/lib/lmstudio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint') || undefined;

  const status = await checkLMStudioHealth(endpoint);
  return NextResponse.json(status);
}
