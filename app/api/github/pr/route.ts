import { NextResponse } from 'next/server';
import { createReadmePullRequest } from '@/lib/github';

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_CONTENT_CHARS = 500_000;

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  const { repo, filePath, content, title, description } = body ?? {};
  if (typeof repo !== 'string' || !REPO.test(repo)) {
    return NextResponse.json({ error: 'repo must look like owner/name' }, { status: 400 });
  }
  // Only Markdown files inside the repository may be written
  if (
    typeof filePath !== 'string' ||
    !/\.(md|markdown)$/i.test(filePath) ||
    filePath.startsWith('/') ||
    filePath.split('/').some((part) => part === '..' || part === '')
  ) {
    return NextResponse.json({ error: 'filePath must be a relative Markdown path' }, { status: 400 });
  }
  if (typeof content !== 'string' || !content.trim() || content.length > MAX_CONTENT_CHARS) {
    return NextResponse.json({ error: 'content is missing or too large' }, { status: 400 });
  }
  const prTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : 'docs: fix README drift';
  const prBody = typeof description === 'string' ? description.slice(0, 20000) : '';

  try {
    return NextResponse.json(await createReadmePullRequest({ repo, filePath, content, title: prTitle, body: prBody }));
  } catch (err: any) {
    console.error('PR creation failed:', err);
    return NextResponse.json({ error: err.message || 'Could not open the pull request' }, { status: 502 });
  }
}
