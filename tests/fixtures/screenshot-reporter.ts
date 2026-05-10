import type { Reporter, FullConfig, Suite, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom Playwright reporter that generates a static HTML gallery
 * showing step-by-step screenshots for each test.
 */
class ScreenshotGalleryReporter implements Reporter {
  private tests: Array<{
    title: string;
    file: string;
    suite: string;
    status: string;
    duration: number;
    steps: Array<{ name: string; screenshot?: string; timestamp: number }>;
    screenshots: string[];
  }> = [];

  private outputDir = './screenshot-gallery';

  onBegin(config: FullConfig, suite: Suite) {
    // Clean output directory
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.mkdirSync(path.join(this.outputDir, 'images'), { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const screenshots: string[] = [];

    // Collect all attachments that are screenshots
    for (const attachment of result.attachments) {
      if (attachment.contentType?.startsWith('image/') && attachment.path) {
        const fileName = `${this.sanitize(test.title)}-${screenshots.length + 1}.png`;
        const destPath = path.join(this.outputDir, 'images', fileName);
        try {
          fs.copyFileSync(attachment.path, destPath);
          screenshots.push(fileName);
        } catch (e) {
          // File might not exist if test was skipped
        }
      }
    }

    // Collect steps
    const steps = result.steps.map((step, i) => ({
      name: step.title,
      timestamp: step.duration,
      screenshot: undefined as string | undefined,
    }));

    this.tests.push({
      title: test.title,
      file: test.parent?.title || '',
      suite: test.parent?.parent?.title || '',
      status: result.status,
      duration: result.duration,
      steps,
      screenshots,
    });
  }

  onEnd(result: FullResult) {
    this.generateHTML();
  }

  private sanitize(str: string): string {
    return str.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 60);
  }

  private generateHTML() {
    const passed = this.tests.filter(t => t.status === 'passed').length;
    const failed = this.tests.filter(t => t.status === 'failed').length;
    const skipped = this.tests.filter(t => t.status === 'skipped').length;
    const total = this.tests.length;

    // Group by file/suite
    const grouped: Record<string, typeof this.tests> = {};
    for (const test of this.tests) {
      const key = test.file || 'Other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(test);
    }

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DartPro — Screenshot Gallery</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0a0a0f; --surface: #13131a; --surface2: #1c1c26;
  --border: rgba(255,255,255,0.08); --accent: #e8ff47;
  --text: #f0f0f0; --muted: #7a7a8a;
  --success: #4ade80; --danger: #f87171; --warn: #fbbf24;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 20px; max-width: 1400px; margin: 0 auto; }
h1 { font-size: 28px; margin-bottom: 8px; }
h1 em { color: var(--accent); font-style: normal; }
.subtitle { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
.stats { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 24px; text-align: center; }
.stat-value { font-size: 32px; font-weight: 800; }
.stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
.stat-value.pass { color: var(--success); }
.stat-value.fail { color: var(--danger); }
.stat-value.skip { color: var(--warn); }
.suite { margin-bottom: 32px; }
.suite-title { font-size: 16px; font-weight: 700; color: var(--accent); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.test-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
.test-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; cursor: pointer; user-select: none; }
.test-header:hover { background: var(--surface2); }
.test-name { font-size: 14px; font-weight: 500; flex: 1; }
.test-status { font-size: 11px; padding: 4px 10px; border-radius: 20px; font-weight: 600; }
.test-status.passed { background: rgba(74,222,128,0.15); color: var(--success); }
.test-status.failed { background: rgba(248,113,113,0.15); color: var(--danger); }
.test-status.skipped { background: rgba(251,191,36,0.15); color: var(--warn); }
.test-duration { font-size: 11px; color: var(--muted); margin-left: 12px; }
.test-body { display: none; padding: 0 18px 18px; border-top: 1px solid var(--border); }
.test-body.open { display: block; padding-top: 14px; }
.screenshots { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
.screenshot-item { position: relative; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); background: var(--surface2); }
.screenshot-item img { width: 100%; height: auto; display: block; cursor: pointer; transition: transform 0.2s; }
.screenshot-item img:hover { transform: scale(1.02); }
.screenshot-label { font-size: 11px; color: var(--muted); padding: 8px 10px; text-align: center; background: var(--surface); }
.step-list { margin-top: 12px; }
.step { font-size: 12px; color: var(--muted); padding: 4px 0; border-bottom: 1px solid var(--border); }
.step:last-child { border-bottom: none; }
.no-screenshots { font-size: 13px; color: var(--muted); font-style: italic; padding: 12px 0; }
.chevron { transition: transform 0.2s; font-size: 12px; color: var(--muted); }
.chevron.open { transform: rotate(180deg); }
.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000; display: none; align-items: center; justify-content: center; padding: 20px; }
.lightbox.show { display: flex; }
.lightbox img { max-width: 95vw; max-height: 90vh; border-radius: 8px; }
.lightbox-close { position: absolute; top: 20px; right: 20px; background: none; border: none; color: white; font-size: 32px; cursor: pointer; }
.timestamp { font-size: 10px; color: var(--muted); margin-top: 4px; }
</style>
</head>
<body>

<h1>Dart<em>Pro</em> — Test Screenshots</h1>
<p class="subtitle">Automatycznie generowana galeria screenshotów z testów E2E (Playwright)</p>

<div class="stats">
  <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div>
  <div class="stat"><div class="stat-value pass">${passed}</div><div class="stat-label">Passed</div></div>
  <div class="stat"><div class="stat-value fail">${failed}</div><div class="stat-label">Failed</div></div>
  <div class="stat"><div class="stat-value skip">${skipped}</div><div class="stat-label">Skipped</div></div>
</div>

${Object.entries(grouped).map(([suite, tests]) => `
<div class="suite">
  <div class="suite-title">${this.escapeHtml(suite)}</div>
  ${tests.map((test, idx) => `
  <div class="test-card">
    <div class="test-header" onclick="toggleTest(this)">
      <span class="test-name">${this.escapeHtml(test.title)}</span>
      <span class="test-status ${test.status}">${test.status === 'passed' ? '✅ PASS' : test.status === 'failed' ? '❌ FAIL' : '⏭ SKIP'}</span>
      <span class="test-duration">${(test.duration / 1000).toFixed(1)}s</span>
      <span class="chevron">▼</span>
    </div>
    <div class="test-body">
      ${test.screenshots.length > 0 ? `
      <div class="screenshots">
        ${test.screenshots.map((img, i) => `
        <div class="screenshot-item">
          <img src="images/${img}" alt="Step ${i + 1}" onclick="openLightbox(this.src)" loading="lazy"/>
          <div class="screenshot-label">Screenshot ${i + 1}</div>
        </div>
        `).join('')}
      </div>
      ` : '<div class="no-screenshots">Brak screenshotów (test pominięty lub bez kroków UI)</div>'}
      ${test.steps.length > 0 ? `
      <div class="step-list">
        <div style="font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Kroki testu</div>
        ${test.steps.slice(0, 20).map(s => `<div class="step">${this.escapeHtml(s.name)}</div>`).join('')}
      </div>
      ` : ''}
    </div>
  </div>
  `).join('')}
</div>
`).join('')}

<div class="lightbox" id="lightbox" onclick="closeLightbox()">
  <button class="lightbox-close" onclick="closeLightbox()">×</button>
  <img id="lightbox-img" src="" alt="Screenshot"/>
</div>

<script>
function toggleTest(header) {
  const body = header.nextElementSibling;
  const chevron = header.querySelector('.chevron');
  body.classList.toggle('open');
  chevron.classList.toggle('open');
}
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('show');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
</script>

<p class="timestamp">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'index.html'), html, 'utf-8');
    console.log(`\n📸 Screenshot gallery generated: ${this.outputDir}/index.html`);
    console.log(`   ${total} tests | ${passed} passed | ${failed} failed | ${skipped} skipped\n`);
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

export default ScreenshotGalleryReporter;
