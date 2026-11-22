# Review — Reality check (ARCHITECTURE-SPINE.md)

- **Lens:** were the committed decisions checked against the installed code, bundled docs and actual runtime behavior, or written from memory?
- **Date:** 2026-11-21
- **Evidence sources:** `package.json`, the installed `node_modules/*/package.json`, the bundled Next docs at `node_modules/next/dist/docs/`, the Next/Zod/Playwright source in `node_modules`, and experiments run on this Windows 11 / NTFS dev machine (Node v24.22.2).
- **Verdict:** **PASS WITH FIXES.** Most Next.js 16 claims check out, and two were confirmed by running a build. Two claims are wrong in practice and must change before stories are written: the Zod `discriminatedUnion` shape (AD-12) and the Windows `rename` behaviour together with the lock-free `read()` (AD-3/AD-4). One ordering assumption about Playwright is also wrong (AD-14).

---

## 1. Stack versions vs package.json / node_modules

| Spine | package.json | Installed | Status |
|---|---|---|---|
| Node >= 22.12 | engines `>=22.12.0` | v24.22.2 on the dev machine | OK. Tests run on Node 24 locally. `@types/node` is 22.20.5. |
| Next 16.4.2 | `16.4.2` | 16.4.2 | OK |
| React/DOM 19.3.0 | `19.3.0` | 19.3.0 / 19.3.0 | OK |
| TypeScript ^5 | `^5` | 5.9.3 | OK |
| Zod ^4.6.7 | `^4.6.7` | 4.6.7 | OK |
| Tailwind ^4 | `^4` | 4.3.3 | OK |
| Vitest ^5.0.5 | `^5.0.5` | 5.0.5 | OK |
| Playwright ^1.64.1 | `^1.64.1` | 1.64.1 | OK |
| "No new dependency" | — | — | OK. Everything needed (`node:crypto`, `node:fs/promises`, zod) is already available. |

## 2. Next.js 16.4.2 claims

### 2.1 `src/proxy.ts` convention: VERIFIED
- `docs/01-app/03-api-reference/03-file-conventions/proxy.md:11` says `middleware` is deprecated and renamed to `proxy`.
- `proxy.md:23` says "in the project root, or inside `src` … same level as `pages` or `app`".
- `03-file-conventions/src-folder.md:33` says "If you're using Proxy, ensure it is placed inside the `src` folder." The repo uses `src/app`, so `src/proxy.ts` is the correct location.
- Export forms: a named `export function proxy` or a default export (`proxy.md:32,62`).

### 2.2 Matcher `/staff/:path*`, "excluding `/staff/login`": PARTIALLY SPECIFIED
- `proxy.md:125-130`: `:path*` means zero or more segments, so `/staff` itself also matches. I confirmed this at runtime: `/staff` returned 307 to `/staff/login?next=%2Fstaff`.
- `/staff/:path*` **also matches `/staff/login`**. The spine says "trừ `/staff/login`" but does not say how. Without an explicit exclusion the redirect loops forever. The two options are a code-level `if (pathname === "/staff/login") return NextResponse.next()` or a regex/negative-lookahead matcher (`proxy.md:634-650`). Matcher values must be static constants (`proxy.md:136`).
- **Fix:** choose the code-level early return. It is simpler and easy to test. Write it into AD-10.
- Side note (security, outside this lens): `next=<path>` is an open-redirect vector. The login page should only accept values that start with `/staff` and do not start with `//`.

### 2.3 Node runtime in proxy, `node:crypto`: VERIFIED (docs + empirical build)
- `proxy.md:255` says "Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting [it] will throw an error." The version history at `proxy.md:806` says v16.0.0 made Node the default.
- `02-guides/authentication.md:1126` says "Proxy uses the Node.js runtime".
- **Empirical:** in a throwaway project linked to this repo's `node_modules`, I built a `src/proxy.ts` that imports `createHmac` and `timingSafeEqual` from `node:crypto`, with `matcher: "/staff/:path*"`. `next build` (Turbopack, 16.4.2) succeeded and listed `ƒ Proxy (Middleware)`. Under `next start`, `/staff` and `/staff/orders/x` returned 307 with the HMAC header computed, and `/staff/login` rendered. The throwaway project has been deleted.
- **Fix (minor):** AD-10/Structural Seed should say "do not export `runtime` from proxy.ts", because the docs say it throws. `proxy.md:19` warns against relying on shared modules or globals in proxy. `staff/session.ts` must therefore stay pure: it may read `process.env`, but it must not use the `globalThis` throttle or anything from `store`. The spine's import rule already says this; keep it.

### 2.4 `export const dynamic = "force-dynamic"`: VERIFIED VALID (because cacheComponents is OFF)
- `next.config.ts` has no `cacheComponents` key (it only has `agentRules: false` and `turbopack.rules`).
- `03-file-conventions/02-route-segment-config/index.md:25` (version history) says "`v16.0.0`: `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` removed when Cache Components is enabled." Note that `dynamic` is **no longer listed** in the main option table there (lines 7-12). It is documented only in `02-guides/caching-without-cache-components.md:7,84-97` ("Previous Model"), where `'force-dynamic'` means "rendered for each user at request time".
- The existing code already uses it: `src/app/orders/page.tsx:13` and `src/app/orders/[id]/page.tsx:15`.
- **Fix (minor):** add an explicit rule to AD-8: "Do not enable `cacheComponents`. Doing so removes `dynamic` and invalidates AD-8; switching requires a new AD that uses `connection()`/Suspense." The decision currently relies on a config default without saying so.
- Route handlers: `01-getting-started/15-route-handlers.md:51` says "Route Handlers are not cached by default." `/api/products*` therefore needs no `dynamic` export. AD-8's sentence "Các page này đặt force-dynamic" should name the **pages** (`/`, `/products/[slug]`, `/staff*`) and leave the API routes out. `/products` and `/orders/[id]` are already dynamic through `searchParams` or the existing export.
- Build-time hazard: any page that reads the store and is *not* dynamic is prerendered during `next build`, which uses multiple worker processes ("Generating static pages using 5 workers" in the empirical build). AD-15 would then run the migration commit at build time, outside the single-process mutex. **Fix:** add a rule that every page importing `features/*/server.ts` must export `dynamic = "force-dynamic"` or already be dynamic, and add a test or lint check for it.

### 2.5 Removing `generateStaticParams` from `/products/[slug]`: VERIFIED SAFE
- `04-functions/generate-static-params.md:6` says it is only for build-time prerendering. Without it, dynamic segments render on demand (`dynamicParams` defaults to `true`, `route-segment-config/index.md:9`). The current file is `src/app/products/[slug]/page.tsx:21-23`. Removing it, together with `force-dynamic`, is consistent.

### 2.6 `PageProps` / `RouteContext` helpers: VERIFIED
- `03-file-conventions/page.md:125,140` says `PageProps` is a global helper after typegen. `route.md:107,119-121` says the same for `RouteContext`. `layout.md:93,110` covers `LayoutProps`, which `staff/layout.tsx` can use.
- The repo already uses them (`src/app/api/orders/[id]/route.ts:6`, `src/app/products/[slug]/page.tsx:27`). The `typecheck` script runs `next typegen && tsc --noEmit`. The new routes `api/staff/orders/[id]/transitions` and `staff/orders/[id]` will get types after `next typegen`/`next dev`.

### 2.7 `cookies()` async in Route Handlers: VERIFIED
- `04-functions/cookies.md:6,67`: `cookies` is **async** and can read/write in Route Handlers. `cookies.md:74,81`: `.set` is allowed only in a Server Function or Route Handler, **not during Server Component render**.
- Consequence for AD-10: `requireStaff()` in a page can only *read* the cookie and `redirect()`. It cannot clear an expired cookie, which is acceptable. `POST /api/staff/session` returns 204 and sets the cookie. Setting it through `(await cookies()).set(...)` and then returning `new Response(null, {status: 204})` is the pattern shown at `route.md:127-137`. Using `NextResponse` + `res.cookies.set` is equally valid and easier to unit-test. Pick one in AD-10.
- Option names match `cookies.md:56` (`httpOnly`, `sameSite`, `secure`, `path`, `maxAge`).

### 2.8 "Next 16 locks `.next/dev/lock`": VERIFIED
- `02-guides/upgrading/version-16.md:893-897` says `next dev` outputs to `.next/dev`, and "a lockfile mechanism prevents multiple `next dev` or `next build` instances". `06-cli/next.md:60` also says dev output goes to `.next/dev`.
- Source: `next/dist/server/lib/router-utils/setup-dev-bundler.js:175` calls `Lockfile.acquireWithRetriesOrExit(path.join(distDir,'lock'), 'next dev', …)`, where distDir is `.next/dev`. `next/dist/build/lockfile.js:117` uses a native OS lock, which is released when the process dies, so `taskkill /F` leaves no stale lock. The second instance prints "Another next dev server is already running" and exits.
- Also true: with `reuseExistingServer: false`, Playwright fails anyway if the port is in use (`playwright/lib/runner/index.js:865`, "is already used … set reuseExistingServer:true"). The conclusion is correct. Note that `next build` uses `.next/lock`, so build and dev can run at the same time.

## 3. Node fs: atomic replace on Windows: **WRONG AS WRITTEN (High)**

AD-3 assumes `writeFile(.tmp) → fsync → rename` gives an atomic replace. AD-4 then says "`read()` không lấy khóa (rename đảm bảo snapshot nhất quán)".

Experiments on this machine (NTFS, Node 24, scratch dir):

| Test | Result |
|---|---|
| `fs.rename(tmp, existing)` with no handle open | Replaces the file. OK. |
| `FileHandle.sync()` exists and works on a file | OK (`typeof h.sync === "function"`). |
| `rename(tmp, target)` while *this same Node process* holds a read handle on `target` | **EPERM** |
| 300 commits, each racing one un-locked concurrent `fs.readFile(target)` (the AD-4 read model) | **78 / 300 renames failed with EPERM.** Readers never saw torn JSON. |
| 300 sequential commits, no readers at all | **2 / 300 EPERM**. These are transient locks, most likely from Defender or the indexer scanning the fresh file. |
| `fs.open(dir).sync()` (directory fsync) | **EPERM on Windows** |

Implications:
1. On Windows a lock-free `read()` is consistent for the *reader*, but it makes the **writer's** `rename` fail. Commits during page renders and queue views will randomly return 500, and the store correctly rolls back. Confirming an order while staff refresh the queue turns into an intermittent 500. The AD-5(b) concurrency test on a real tmp file will be flaky on the dev machine.
2. Even with no in-process readers, antivirus, an editor or a backup copy opening `shop-store.json` causes EPERM/EBUSY/EACCES.
3. The existing `order-repository.ts:29-32` has the same latent problem. It is "[ADOPTED]" but was never stressed.

**Fix (AD-3/AD-4):**
- Commit = write `.tmp` → `FileHandle.sync()` → `rename`, **retrying `rename` on `EPERM | EACCES | EBUSY` with backoff** (for example 10 tries, 10→200 ms, about 1 s total; graceful-fs uses the same approach). If the retries run out, throw. The mutator result is discarded and nothing is half-written.
- Either run `read()` through the same mutex (cheap at under 100 orders a day), or keep reads lock-free and rely on the retry. Taking the lock for reads is the deterministic choice on Windows. AD-4's line "read() không lấy khóa" needs to change or be justified with the retry.
- Spell out the fs port in AD-5 against the real API: `open(tmp,'w') → handle.writeFile → handle.sync() → handle.close() → rename`. A bare `fsync` function does not match the `FileHandle` API.
- Commit must `mkdir(dirname, {recursive:true})`, as the legacy repo does. This is needed for the AD-14 `.e2e/` deletion below.
- Directory fsync: do not do it on win32 (EPERM). If production is Linux and power-loss durability matters, fsync the directory only when `process.platform !== "win32"`. Otherwise state that the guarantee covers process crashes, not power loss. This matches the "tiến trình chết" scope in "Prevents".

## 4. Zod 4 `discriminatedUnion` (AD-12 transitions body): **WRONG AS WRITTEN (High)**

AD-12 says the body is "discriminated theo `to`". Two variants share `to: "cancelled"`: from `pending|confirmed` with reason ∈ 4 values, and from `shipping` with `reason: "delivery_failed"` and `returnedToShop: true`.

- Zod source `node_modules/zod/v4/core/schemas.js:1377`: `throw new Error(\`Duplicate discriminator value "${value}"\`)`.
- **Empirical:** `z.discriminatedUnion("to", [cancelEarly, cancelShipping, confirm])` → threw `Duplicate discriminator value "cancelled"`.
- **Works:** nesting, i.e. `z.discriminatedUnion("to", [z.discriminatedUnion("from", [pendingCancel, confirmedCancel, shippingCancel]), confirm, …])`. This parsed both cancel variants correctly. Zod 4 accepts a nested discriminated union as an option (same file, lines around 1373-1400).
- "`other` requires `note`" cannot be expressed by the discriminator. It needs `.superRefine` or a further nested union on `reason`.
- Errors from an unmatched discriminator come out as `code: "invalid_union", path: ["to"]`. The existing `toFieldErrors` (`src/features/checkout/checkout-schema.ts:68`) has to map that to a usable Vietnamese message.
- **Fix:** rewrite the AD-12 schema rule as "discriminated on `to`; the `cancelled` branch is itself discriminated on `from`; the `reason: other ⇒ note` rule goes in `superRefine`". Better still, put the schema in `orders/transition-schema.ts` and derive it from `ORDER_TRANSITIONS` (AD-6) so the server and UI share one source.

## 5. Playwright `webServer.env` / `globalSetup` (AD-14)

- `webServer.env` exists (`playwright/types/test.d.ts:11110`). It is **merged** over `process.env` (`playwright/lib/runner/index.js:872-876`: `{...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env, ...options.env}`), so test values win over the shell environment and over `.env.local`, because Next does not override existing env vars. VERIFIED.
- `reuseExistingServer?: boolean` (`test.d.ts:11147`) and `globalSetup?: string | string[]` (`test.d.ts:1386`) both exist. VERIFIED.
- **Ordering is WRONG (Medium).** `playwright/lib/runner/index.js:6509-6515` `createGlobalSetupTasks` runs `createRemoveOutputDirsTask` → **`createPluginSetupTasks` (webServer start + readiness probe)** → globalTeardowns → **globalSetups**. So `globalSetup` deletes `.e2e/` **after** the dev server is up and after the readiness probe has requested `/`. Once `/` is `force-dynamic` and reads stock, that request triggers the AD-15 migration and writes `.e2e/shop-store.json`. The rule "globalSetup xóa `.e2e/`" therefore deletes a live store under a running server, and the result depends on ordering.
  - **Fix:** clean `.e2e/` before the server starts, either at the top level of `playwright.config.ts` (`fs.rmSync('.e2e', {recursive:true, force:true})` runs when the config loads, before plugins) or in `webServer.command` (`node e2e/clean.mjs && next dev`). Also make the commit `mkdir -p` (§3).
- `gracefulShutdown` is ignored on Windows (`test.d.ts:11116`). The dev server is force-killed, which is acceptable because the native lock is released (§2.8).
- The current `playwright.config.ts` has `reuseExistingServer: !process.env.CI` and no `env`/`globalSetup`. The spine correctly treats this as a change.

## 6. Other items checked

| Claim | Status | Note |
|---|---|---|
| `timingSafeEqual` for PIN compare | OK with a caveat | It throws on unequal lengths. PINs are 4–8 digits, so compare fixed-length digests (HMAC or SHA-256 of each PIN) rather than raw strings. Add this to AD-10. |
| `x-forwarded-for` first value as the IP (AD-11) | Weak | With plain `next start` and no reverse proxy, the client controls this header, so the per-IP lock can be bypassed. The 30/60-min global lock is the real backstop. Write that down, or read the socket address only when no trusted proxy is present. |
| `globalThis` singletons for the mutex and throttle survive HMR | Plausible, not verified | Standard pattern. Proxy must not depend on them (`proxy.md:19`), and the spine already keeps the throttle out of proxy. |
| `.gitignore` | Gap | `storage/` and `.e2e/` are not ignored today. The spine already lists this as a change. |
| `STORE_FILE` relative path, mutex key = absolute path | OK | Requires `path.resolve(process.cwd(), STORE_FILE)` in `store/server.ts`. State this. |
| `router.refresh()`, Route Handler + `fetch` pattern | OK | The existing `CancelOrderButton` pattern. |

## 7. Unverified / not checked
- The `globalThis` mutex being shared across the separate server bundles Turbopack may produce (RSC versus route-handler layers) in `next dev`. This is likely fine, but no test covers it. Recommendation: one dev-mode integration smoke test where a page read and an API confirm hit the same mutex.
- Production OS is not stated. The durability guarantees differ between Linux (directory fsync available) and Windows (§3).

## 8. Observation (tool output, not acted on)
The first `next build` run in the empirical proxy test printed an advisory saying the CLI recommends `next upgrade --agent=security` (it cites the npm bulk advisories endpoint). I did not run it. The user may want to check `npm audit` for `next@16.4.2` separately, because a security advisory against the pinned version would affect the Stack table.

---

## Findings summary

| # | Severity | Finding | Fix |
|---|---|---|---|
| R1 | High | On Windows, `rename` over a file that is open or being scanned fails with EPERM. Measured 78/300 failures with lock-free concurrent reads and 2/300 with none. AD-4's lock-free `read()` causes this. | Retry rename on EPERM/EACCES/EBUSY with backoff; run reads through the mutex (or justify); `mkdir -p`; no directory fsync on win32. |
| R2 | High | `z.discriminatedUnion("to", …)` with two `to:"cancelled"` variants throws `Duplicate discriminator value` (zod `v4/core/schemas.js:1377`, reproduced). | Nested discriminated union on `from` inside the `cancelled` branch, plus `superRefine` for `other ⇒ note`. |
| R3 | Medium | Playwright runs webServer *before* globalSetup (`runner/index.js:6509-6515`), so deleting `.e2e/` in globalSetup races the live server and the migration it already ran. | Clean in config top level or in `webServer.command`. |
| R4 | Medium | Matcher `/staff/:path*` includes `/staff/login`. The spine does not say how login is excluded, so the redirect can loop. | Code-level early return for `/staff/login` in `proxy.ts`; validate `next`. |
| R5 | Low | `force-dynamic` is valid only because `cacheComponents` is off, and that dependency is unstated. Pages that read the store without being dynamic would run the migration during the multi-worker `next build`. | Add "cacheComponents stays off" and "every page importing `features/*/server.ts` is dynamic" to AD-8; API routes need nothing (not cached by default). |
| R6 | Low | The AD-5 fs port lists a bare `fsync`, but the real API is `FileHandle.sync()`. `timingSafeEqual` throws on length mismatch. | Shape the port around `FileHandle`; compare fixed-length digests. |

Verified as correct: the `src/proxy.ts` location, Node runtime and `node:crypto` in proxy (built and run), `force-dynamic` validity with the current config, removing `generateStaticParams`, the `PageProps`/`RouteContext` helpers, async `cookies()` in handlers, `webServer.env` merge semantics, the `.next/dev/lock` claim, and all Stack versions.
