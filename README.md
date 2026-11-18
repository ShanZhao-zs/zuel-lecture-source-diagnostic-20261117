# One-time public lecture-source diagnostic

This repository contains only standalone diagnostic code and this description.
It does not contain the lecture assistant project, private files, application
IDs, calendar IDs, secrets, cookies, cloud credentials or personal data.

The first two workflow runs ended before any diagnostic step started because
GitHub reported an account billing lock. On 2026-11-18 the owner requested
another cloud-collection test. This is one additional bounded try, using
the same standard `ubuntu-latest` hosted runner and four confirmed public URLs:

- `https://csxy.zuel.edu.cn/7106/list.htm`
- `https://jjxy.zuel.edu.cn/2834/list.htm`
- `https://wls.zuel.edu.cn/xsdt/list.htm`
- `https://jmxy.zuel.edu.cn/xsjz2/list.htm`

The economics source now uses its confirmed lecture column 2834, not the old
2733 candidate. Article links must match each college's exact lecture column
(7106, 2834, 10640 and 17989 respectively), not an arbitrary same-site article.

## Boundaries

- One ordinary headless Chromium navigation per source, sequentially. Navigation
  is limited to 20 seconds and normal network settling to at most 5 seconds,
  with a 25-second per-source navigation/read deadline (plus initialization
  and bounded cleanup). The entire job has a five-minute hard limit.
- Default browser identity. No stealth packages, user-agent override, custom
  headers, cookies, authentication, init-script injection, challenge solving,
  response decryption or private API calls.
- HTTP requests are limited to each current college's HTTPS origin and the
  already-observed official `https://info.zuel.edu.cn/uv.js` script. Top-level or
  frame documents must remain at the exact approved source URL. Downloads and
  service workers are disabled to retain this network boundary.
- Explicit protection pages are identified and the source attempt stops. The
  program does not remove or conceal automation indicators. A protection page,
  timeout, HTTP failure or zero valid links is not reported as “no new lectures”.
- The only diagnostic output is JSON containing the fixed source name, HTTP
  status, page title (maximum 120 characters), same-column article-link count,
  up to three public article URLs, protection flag and an enumerated result.
  No HTML, page console, cookies,
  screenshots, traces, attachments, artifacts, caches or decrypted content are
  uploaded.
- `permissions: {}`; no secrets or access tokens are referenced. The workflow
  clones this public repository via its plain HTTPS URL without a checkout
  action or credentials and checks its commit against the triggering SHA.
- Only a push changing the workflow file can trigger this workflow. The job
  now requires exactly run number 3 and attempt 1, corresponding to this newly
  requested single try. No automatic fourth run is allowed. There is no schedule,
  dispatch, pull-request trigger, automatic retry or second cloud provider.
- The job is limited to five minutes and uses the standard public-repository
  runner. It does not enable a paid plan, larger runner, persistent server or
  any billing action. Dependency installation occurs only in the disposable
  runner, not on the owner's computer.

The official npm registry confirmed `playwright` **1.65.1** again on
2026-11-18. The workflow pins that exact version and installs its official
Chromium build with Microsoft's documented CLI. No third-party Actions are used.

## Upload order and interpretation

For this specifically requested repeat, upload and verify the updated script
and README first, then update the workflow last; that workflow push initiates
the sole newly requested run number 3. Do not rerun the old job or
change the branch again while the diagnostic is running.

A `public_list_readable` result establishes only that this particular runner
could read article links during this one request. It does **not** establish
complete coverage, valid lecture extraction, future-date filtering, Feishu
delivery, calendar insertion or twice-daily operation. A failed result leaves
the lecture assistant's collection disabled. This diagnostic never writes to
Cloudflare, Feishu or any calendar.

The module accepts an injected mock Chromium/browser interface for local tests.
Importing it does not import Playwright, launch a browser or access a website.
Running `node probe.mjs` directly is reserved for the approved hosted run.

References:

- [Official Playwright CI guide](https://playwright.dev/docs/ci)
- [Official npm registry metadata](https://registry.npmjs.org/playwright/latest)
