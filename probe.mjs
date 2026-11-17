import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Standalone public diagnostic. No imports from the lecture assistant project.
export const SOURCES = Object.freeze([
  Object.freeze({ id: 'finance', url: 'https://csxy.zuel.edu.cn/7106/list.htm' }),
  Object.freeze({ id: 'economics', url: 'https://jjxy.zuel.edu.cn/2733/list.psp' }),
]);

export function protectionFlag(html) {
  if (typeof html !== 'string') return false;
  return (html.includes('_tox_') && /navigator\s*\.\s*webdriver/.test(html) && /HeadlessChrome|Puppeteer|Playwright/.test(html)) ||
    (/cf-chl-|challenge-platform|g-recaptcha|h-captcha/i.test(html) && /captcha|verify|verification|人机验证|安全验证/i.test(html));
}

export function allowedRequest(sourceId, input, resourceType = 'other') {
  const source = SOURCES.find(item => item.id === sourceId);
  if (!source) return false;
  let url;
  try { url = new URL(input); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const origin = new URL(source.url).origin;
  if (resourceType === 'document') return url.href === source.url;
  return url.origin === origin ||
    (resourceType === 'script' && url.origin === 'https://info.zuel.edu.cn' && url.pathname === '/uv.js' && !url.search);
}

export function articleCount(sourceId, html) {
  const source = SOURCES.find(item => item.id === sourceId);
  if (!source || typeof html !== 'string' || protectionFlag(html)) return 0;
  const origin = new URL(source.url).origin, found = new Set();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    try {
      const url = new URL(match[1].replaceAll('&amp;', '&'), source.url);
      if (url.origin === origin && !url.username && !url.password &&
          /^\/\d{4}\/\d{4}\/c\d+a\d+\/page\.(?:htm|psp)$/.test(url.pathname)) found.add(url.origin + url.pathname);
    } catch { /* Ignore malformed/non-article links, never infer content. */ }
  }
  return found.size;
}

function shortTitle(value) {
  return [...String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, 120).join('');
}

async function bounded(promise, timeout) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Bounded diagnostic stage'), { name: 'DiagnosticTimeout' })), Math.max(1, timeout));
    })]);
  } finally { clearTimeout(timer); }
}

// Injectable browser interface permits local mock checks without installing or
// launching Playwright. Only the CLI entry point imports the official package.
export async function probeSource(browser, sourceId) {
  const source = SOURCES.find(item => item.id === sourceId);
  if (!source) throw new Error('Unknown fixed source');
  const result = { source: source.id, http_status: null, title: '', same_origin_articles: 0,
    protection_detected: false, result: 'diagnostic_error' };
  const deadline = Date.now() + 25000;
  const remaining = cap => Math.max(1, Math.min(cap, deadline - Date.now()));
  let context, page, blockedNavigation = false, navigationFailed = false;
  try {
    context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const request = route.request(), type = request.resourceType();
      if (!allowedRequest(source.id, request.url(), type)) {
        if (type === 'document') blockedNavigation = true;
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    page = await context.newPage();
    page.setDefaultTimeout(5000);
    try {
      const response = await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const status = response?.status();
      if (Number.isInteger(status)) result.http_status = status;
    } catch { navigationFailed = true; }

    let html = await bounded(page.content(), remaining(2000));
    result.title = shortTitle(await bounded(page.title(), remaining(1000)));
    result.protection_detected = protectionFlag(html);
    if (result.protection_detected) {
      result.result = 'source_protection_detected';
      return result;
    }
    if (blockedNavigation) {
      result.result = 'out_of_scope_navigation_blocked';
      return result;
    }
    if (navigationFailed) {
      result.result = 'navigation_failed_or_timed_out';
      return result;
    }

    // One bounded normal settle, no retry, selector challenge wait or click.
    const settleBudget = Math.min(5000, Math.max(0, deadline - Date.now() - 2000));
    if (settleBudget > 0) {
      try { await page.waitForLoadState('networkidle', { timeout: settleBudget }); } catch { /* Snapshot what is normally available. */ }
    }
    html = await bounded(page.content(), remaining(1500));
    result.title = shortTitle(await bounded(page.title(), remaining(500)));
    result.protection_detected = protectionFlag(html);
    if (result.protection_detected) result.result = 'source_protection_detected';
    else if (blockedNavigation || page.url() !== source.url) result.result = 'out_of_scope_navigation_blocked';
    else if (html.length > 450000) result.result = 'content_size_limit';
    else if (result.http_status !== 200) result.result = 'source_http_error';
    else {
      result.same_origin_articles = articleCount(source.id, html);
      result.result = result.same_origin_articles > 0 ? 'public_list_readable' : 'no_valid_article_links';
    }
  } catch {
    result.result = 'diagnostic_failed_or_timed_out';
  } finally {
    if (context) { try { await bounded(context.close(), 2000); } catch { /* Browser closes at run end. */ } }
  }
  return result;
}

export async function runDiagnostic({ chromium, emit = value => console.log(JSON.stringify(value)) }) {
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ headless: true, timeout: 20000 });
    for (const source of SOURCES) {
      const result = await probeSource(browser, source.id);
      results.push(result); emit(result);
    }
  } catch {
    for (const source of SOURCES.filter(item => !results.some(result => result.source === item.id))) {
      const result = { source: source.id, http_status: null, title: '', same_origin_articles: 0,
        protection_detected: false, result: 'browser_unavailable' };
      results.push(result); emit(result);
    }
  } finally {
    if (browser) { try { await bounded(browser.close(), 2000); } catch { /* Hosted runner is ephemeral. */ } }
  }
  return results;
}

async function main() {
  const { chromium } = await import('playwright');
  const results = await runDiagnostic({ chromium });
  if (results.some(result => result.result !== 'public_list_readable')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.log(JSON.stringify({ result: 'diagnostic_runner_error' }));
    process.exitCode = 1;
  });
}
