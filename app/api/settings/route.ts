import { NextResponse } from 'next/server';
import { getDefaultSettings, loadSettings, saveSettings } from '@/lib/settings';
import { sanitizeSettings } from '@/lib/settingsSchema';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ settings: loadSettings(), defaults: getDefaultSettings() });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errors: ['Request body must be JSON'] }, { status: 400 });
  }

  const { settings, errors } = sanitizeSettings(body, loadSettings());
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    saveSettings(settings);
  } catch (err: any) {
    return NextResponse.json({ errors: [`Could not save settings: ${err.message}`] }, { status: 500 });
  }
  return NextResponse.json({ settings });
}
