import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactsQaDir = path.join(rootDir, 'artifacts', 'qa');

if (!fs.existsSync(artifactsQaDir)) {
  fs.mkdirSync(artifactsQaDir, { recursive: true });
}

// Find Chrome or Edge
const browserCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

const browserExe = browserCandidates.find((exe) => fs.existsSync(exe));
if (!browserExe) {
  console.error('No Chrome or Edge browser executable found.');
  process.exit(1);
}
console.log(`Using browser: ${browserExe}`);

// Start vite preview on port 4173
console.log('Starting frontend preview server...');
const previewProcess = spawn('npx.cmd', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  cwd: path.join(rootDir, 'frontend'),
  stdio: 'pipe',
  shell: true,
});

previewProcess.stdout.on('data', (d) => process.stdout.write(d));
previewProcess.stderr.on('data', (d) => process.stderr.write(d));

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 304) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} not responding within ${timeoutMs}ms`);
}

function takeScreenshot(url, outputPath, width, height, delayMs = 1500) {
  return new Promise((resolve, reject) => {
    console.log(`Capturing: ${url} -> ${outputPath} (${width}x${height})`);
    const args = [
      '--headless=new',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      `--virtual-time-budget=${delayMs}`,
      `--screenshot=${outputPath}`,
      url,
    ];

    const child = spawn(browserExe, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`Saved: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`Browser exited with code ${code} for ${outputPath}`));
      }
    });
  });
}

try {
  await waitForServer('http://127.0.0.1:4173');
  console.log('Preview server ready.');

  // 1. Homepage desktop
  await takeScreenshot(
    'http://127.0.0.1:4173/',
    path.join(artifactsQaDir, 'homepage-desktop.png'),
    1440,
    1000
  );

  // 2. Homepage mobile
  await takeScreenshot(
    'http://127.0.0.1:4173/',
    path.join(artifactsQaDir, 'homepage-mobile.png'),
    375,
    812
  );

  // 3. Login page
  await takeScreenshot(
    'http://127.0.0.1:4173/login',
    path.join(artifactsQaDir, 'login.png'),
    1440,
    900
  );

  // 4. How it works page (bonus verification)
  await takeScreenshot(
    'http://127.0.0.1:4173/how-it-works',
    path.join(artifactsQaDir, 'how-it-works.png'),
    1440,
    900
  );

  console.log('Public screenshots successfully captured!');
} catch (err) {
  console.error('Screenshot error:', err);
} finally {
  console.log('Shutting down preview server...');
  previewProcess.kill();
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', previewProcess.pid.toString(), '/f', '/t']);
    } catch {}
  }
}
