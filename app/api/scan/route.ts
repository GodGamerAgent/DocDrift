import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { analyzeLocalDirectory, analyzeSampleRepo } from '@/lib/analyzer';
import { SAMPLE_REPOS } from '@/lib/sampleRepos';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repoUrl, sampleId } = body;

    // 1. If sample repo requested
    if (sampleId && SAMPLE_REPOS[sampleId]) {
      const result = await analyzeSampleRepo(sampleId);
      return NextResponse.json(result);
    }

    // 2. If GitHub URL requested
    if (repoUrl && typeof repoUrl === 'string') {
      const trimmedUrl = repoUrl.trim();

      // Quick validation
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.includes('github.com')) {
        return NextResponse.json(
          { error: 'Invalid URL. Please enter a valid public GitHub repository URL (e.g., https://github.com/expressjs/express).' },
          { status: 400 }
        );
      }

      // Extract repo name
      const parts = trimmedUrl.replace(/\.git$/, '').split('/');
      const repoName = parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : 'cloned-repository';

      // Create isolated temporary directory
      const tempBase = path.join(os.tmpdir(), 'docdrift_clones');
      if (!fs.existsSync(tempBase)) {
        fs.mkdirSync(tempBase, { recursive: true });
      }

      const cloneDir = path.join(tempBase, `repo_${Date.now()}_${Math.random().toString(36).substring(7)}`);

      try {
        // Run shallow git clone with 20 second timeout
        console.log(`[DocDrift] Cloning ${trimmedUrl} into ${cloneDir}...`);
        await execAsync(`git clone --depth 1 --single-branch "${trimmedUrl}" "${cloneDir}"`, {
          timeout: 25000,
        });

        const result = await analyzeLocalDirectory(cloneDir, repoName, trimmedUrl);

        // Cleanup cloned files asynchronously in background to free disk
        setTimeout(() => {
          try {
            fs.rmSync(cloneDir, { recursive: true, force: true });
          } catch (e) {
            // ignore
          }
        }, 15000);

        return NextResponse.json(result);
      } catch (cloneErr: any) {
        console.error('Git clone failed:', cloneErr);
        return NextResponse.json(
          {
            error: `Failed to clone repository: ${cloneErr.message || 'Clone timed out or repo is private/unavailable'}. Try one of the built-in showcase repos!`,
          },
          { status: 500 }
        );
      }
    }

    // Default fallback to first sample repo
    const defaultResult = await analyzeSampleRepo('deployx-cli');
    return NextResponse.json(defaultResult);
  } catch (err: any) {
    console.error('Scan API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
