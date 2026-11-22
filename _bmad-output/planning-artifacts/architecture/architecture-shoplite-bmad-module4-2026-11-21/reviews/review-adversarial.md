---
review: adversarial
target: ARCHITECTURE-SPINE.md (ShopLite: Vận hành đơn hàng, draft 2026-11-21)
grounded_in: commit 805f721 (src/features/orders/*, src/features/catalog/catalog-service.ts, src/lib/http.ts, src/app/**, playwright.config.ts, .gitignore)
date: 2026-11-21
verdict: NOT READY — 3 critical, 6 high holes; all closable with tightened ADs (no paradigm change)
---

# Adversarial Review — Architecture Spine

**Method.** For each hole, two units one level down (stories built by different devs) are constructed so that each one follows every AD to the letter, yet together they produce an incompatible or incorrect system. Each hole ends with a concrete AD fix. Severity: **Critical** = oversell or wrong stock / data loss in normal use; **High** = incorrect behaviour or security gap that will likely ship; **Medium** = divergence or brittleness; **Low** = polish.

## Verdict

The spine is solid in *intent* (single file, single mutex, CAS inside the mutator, pure core). But the enforcement surface has gaps that the letter of the ADs allows:

1. The `OrderRepository.save` façade (AD-4) is a write path that is *inside* the mutex but whose *decision* is made outside it. That reopens exactly the lost-update / double-stock bugs AD-4 and AD-6 exist to prevent. The existing `cancelOrder` code already follows this read-then-save pattern.
2. The lazy seed for inventory (AD-8) has no single owner and no defined meaning inside a mutator. That allows NaN, 0 or seed values, and a commit-time invariant failure.
3. The state Zod schema (AD-15) strips unknown keys by default, so any story that adds a field silently erases another story's data.

Fix these three before stories are cut. The rest can be tightened in the same pass.

---

## Critical

### C1. `OrderRepository.save` = "upsert in mutex" lets a whole-order decision be made on a stale `read()`

- **Unit A (FR-2 story, customer cancel).** AD-7 says `cancelOrder` "chạy qua `store.update`". The dev keeps today's shape (`order-service.ts:124-134`): `getOrder(id)` → `repository.findById` → `store.read()` (lock-free, AD-4) → checks `status === "pending"` → `repository.save({...order, status:"cancelled"})`. `save` is `update` upsert (AD-4), so it *is* "through `store.update`". This is compliant.
- **Unit B (FR-9 story, staff confirm).** Correct mutator: CAS `from`, deduct, `stockApplied=true`, commit.
- **Interleaving.** A reads `pending`. B commits `confirmed` and deducts X×2. A's `save` replaces the whole order with its stale snapshot: `status:"cancelled"`, no `stockApplied`, and the `statusHistory` entry from B is gone. **Result:** the order is cancelled, stock stays deducted forever, there is no restock path (AD-6 restocks only when `stockApplied === true`), and SM-2 breaks. FR-10's "who did it" is erased.
- **The same pattern** hits FR-22: a customer cancel-request does `save({...order, flags:{cancelRequestedAt}})` from a stale read and reverts a concurrent staff `confirmed→shipping`.
- **Fix (tighten AD-4 + AD-7):**
  - "Every state change to an existing order is decided **inside** a mutator from the `ShopState` passed to it. A value obtained from `read()` must never be written back."
  - Remove `save` from the façade, or make it **insert-only** (`create(order)`, which throws if the id exists). The façade keeps `findAll`/`findById` only for reads.
  - `cancelOrder` and the FR-22 request become `store.update(s => cancelPendingMutator(s, id, now))` with the status check inside.
  - Add a lint/grep check in CI: no `repository.save(` and no `store.read()` inside `*-service.ts` methods that also call `update`.

### C2. Lazy inventory seed has two possible owners and undefined in-mutator semantics

AD-8: "Key thiếu → giá trị khởi tạo = `stock` trong `products.ts` (seed lazy)". It does not say *who* applies the seed, *when*, or whether it is persisted.

- **Unit A (FR-5/FR-3 read side, inventory story).** `inventoryService.getStockLevels()` = `read()` then fill missing keys from `products.ts` **in memory** (AD-8 forbids anything but order mutators from writing inventory, so it does not persist). Product pages show 25.
- **Unit B (FR-9, orders story).** The confirm mutator calls `deduct(state.inventory, items)` from `inventory/stock.ts`. Two equally compliant ways to write `deduct` / `checkShortfall`:
  - `state.inventory[id] ?? 0` → every first confirm fails with `INSUFFICIENT_STOCK` "còn 0".
  - `state.inventory[id] - qty` → `NaN`; AD-4's pre-commit check `inventory[id] >= 0` is false for NaN → commit throws → 500.
  - A third dev imports `products.ts` inside `stock.ts` (allowed: `inventory → catalog`) → works, but now a pure core function depends on module data. FR-21 "low stock" and SM-2's "khởi tạo" baseline are then computed from whatever `products.ts` says *today*, not from what was in effect at materialization time.
- **Drift.** If someone edits `products.ts` stock for a product whose key was never materialized, live stock silently jumps. SM-2 ("khởi tạo − đã xác nhận + đã hoàn") has no recorded baseline.
- **Fix (new AD-8a, "Inventory materialization"):**
  - One pure function `effectiveLevels(state.inventory, seed): Record<ProductId, number>` in `inventory/stock.ts`, where `seed` is **passed in** (built in `inventory/server.ts` from `products.ts`). Every reader *and* every mutator uses it. Nothing else reads `state.inventory[...]` directly.
  - **Persistence.** The first `update` of any kind (including placeOrder and legacy import) materializes all missing keys into `state.inventory` and records `inventoryBaseline` (or the first ledger entries with `reason:"seed"`) in the same commit. After that the file is the only truth, and the `products.ts` `stock` is ignored for materialized keys.
  - Pre-commit invariant: `Number.isInteger(v) && v >= 0` for every value, plus every `productId` referenced by an order item exists in `inventory`.

### C3. Zod `safeParse` on read strips unknown keys → one story erases another's data

AD-15 / Conventions: "Zod cho … file trạng thái khi đọc". Zod 4 `z.object` **strips unknown keys by default**. AD-4 `update` = read (parse) → mutator → commit the parsed object.

- **Unit A (FR-20 SHOULD, ledger).** Adds `stockLedger` entries. The shape is deferred, so the dev adds it to `inventory/types.ts`. Per Deferred, they may not touch `state-schema.ts` (owned by the store story).
- **Unit B (any later write, e.g. a placeOrder).** Parses state with a schema that does not know `stockLedger`. Zod drops it, commit writes it back → **ledger deleted**. The same happens with `flags.packed` (OQ-3), `cancellation.note`, or any optional field added to `Order` without a matching schema edit. AD-9 says "trường mới đều optional", which makes this the *expected* way to extend.
- **Fix (tighten AD-15 + Conventions):**
  - `store/state-schema.ts` is the **single source of the types**: `Order`, `StatusChange`, `ShopState` = `z.infer<…>`. `orders/types.ts` re-exports them. A new field cannot exist in TS without existing in the schema.
  - Use `z.looseObject` (passthrough) at every level of the persisted schema, so unknown keys survive.
  - Mandatory round-trip test: `parse(serialize(fixtureWithAllOptionalFields))` deep-equals the fixture.

---

## High

### H1. Legacy import (AD-15) violates the import graph and races itself

- **Graph contradiction.** AD-15 says the store reads `ORDERS_FILE` using `createJsonFileOrderRepository` (in `features/orders`). The graph says "`store` không import feature nào ngoài kiểu dữ liệu". A dev doing AD-15 must break the graph, or must reimplement the reader and break "giữ nguyên … cùng test của nó".
- **Lock contradiction.** "Lần `read/update` đầu tiên mà `STORE_FILE` chưa tồn tại … commit một lần trong mutex", but AD-4 says "`read()` không lấy khóa". Unit A (`read()` triggers import, takes the lock) and Unit B (`read()` never locks, returns empty state) are both compliant. Unit B makes the first `/staff` page render after deploy show **zero orders**, even though orders exist in `orders.json`.
- **Race.** Request 1 `read()` sees no file and enqueues an import. Request 2 `update` (placeOrder) imports + adds the new order + commits. Request 1's queued import then runs; if it does not re-check existence *inside* the lock, it commits legacy-only state → **the new order is lost**.
- **Silent data loss on import.** The existing `readAll` returns `[]` when the JSON is valid but not an array (`order-repository.ts:22`). The import commits `orders: []`, and since `STORE_FILE` now exists it never retries. Separately, legacy orders are imported "nguyên trạng" and unvalidated. If one is malformed, every later Zod read fails → **permanent 500** (AD-15 says don't overwrite, so it cannot self-heal).
- **Fix (rewrite AD-15):**
  - The store receives `loadLegacyOrders: () => Promise<unknown>` **injected** from `store/server.ts`, which wires the orders reader. This keeps the graph intact.
  - Import runs only in `ensureInitialized()`, executed **inside the mutex**, and re-checks `STORE_FILE` existence after acquiring the lock.
  - `read()` on a missing file calls `ensureInitialized()` (the one exception to lock-free reads), or returns the legacy-derived state without writing. Pick one and name it.
  - Legacy data is validated with the same schema before import. Non-array or invalid data → throw, write nothing, log via `handleRouteError`. The import also materializes inventory (C2).

### H2. Staff login rate limit keyed on spoofable `x-forwarded-for`; global lock is a free DoS

AD-11 keys on the first XFF value, falling back to `"unknown"`. The operating environment is a single `next start` with no reverse proxy (Stack/Môi trường), so XFF is **fully client-controlled**.

- An attacker rotates XFF on every request, so the per-IP limit never triggers. Only the global limit remains: 30 attempts/hour → the 4-digit space is exhausted in about 14 days (expected success after about 7). With a 2-staff config, 2 of the 10k PINs are valid, so the expected time is about 3.5 days.
- The same attacker sends 30 wrong PINs per hour and **locks every staff member out indefinitely**. The 15-minute lock re-arms after each burst.
- **Fix (tighten AD-11 + AD-10):**
  - The IP comes from the socket address unless `TRUSTED_PROXY_HOPS` is set (then take the Nth-from-right XFF entry).
  - Raise the minimum PIN length to 6 digits.
  - Replace the global hard-lock with a global *slowdown* (e.g. ≥2 s per failed attempt, serialized), so legitimate staff can still log in during an attack. An already-valid session is never affected.

### H3. `timingSafeEqual` on raw PINs of different length throws

AD-10 requires PINs of 4–8 digits compared with `timingSafeEqual` "duyệt toàn bộ danh sách". `crypto.timingSafeEqual` **throws `RangeError`** when the buffer lengths differ. One dev catches the error and treats it as unequal (which leaks length via the exception path timing). Another lets it propagate (500). A third pads the inputs, and implementations will disagree.

- **Fix:** compare `HMAC-SHA256(STAFF_SESSION_SECRET, candidate)` against the precomputed HMAC of each configured PIN. These are fixed 32-byte buffers, compared against every entry without early exit. Put this in `staff/session.ts` with a test for mixed-length PINs.

### H4. Torn snapshot on the Queue: Đèn tồn kho computed from two separate reads

The queue page (AD-13: "Server Component đọc service trực tiếp") calls `orderService.listOrders()` (read #1) and `inventoryService.getStockLevels()` (read #2). A confirm committing between the two reads produces an order shown as `pending` with stock *already deducted for it*. Its light goes red or amber falsely, and staff, following the UI, cancel with reason `out_of_stock`. AD-6 protects the *confirm*, but the *cancel decision* is made by a human on a torn view, and cancelling `pending` has no CAS on stock.

- **Placement conflict (two owners).** The capability map puts Đèn in `inventory/stock.ts`, but computing it needs `Order.items`, and `inventory` may not import `orders`. Dev A types it structurally inside inventory; Dev B writes `orders/stock-light.ts`. Two implementations, two colour rules. The competing-pending-orders rule is unspecified.
- **Fix (new AD):**
  - Views that combine orders and inventory come from **one** `store.read()` via `orderService.getQueueView()`, which returns `{ orders, levels, lights }`.
  - `inventory/stock.ts` exposes only structural functions over `{productId, quantity}[]`.
  - The light rule (green/amber/red, and whether other pending orders count) lives in exactly one file, `orders/stock-light.ts`, with tests.

### H5. AD-8 "overlay *before* calling catalog functions" is not implementable against the current catalog, and the obvious workaround corrupts a module singleton

`getProductBySlug`, `getRelatedProducts`, `getFeaturedProducts` and `getProductById` (catalog-service.ts:47-68) read the module-level `products` constant and take **no `source` parameter**. Only `queryProducts` has one. So "withLiveStock(products, levels) trước khi gọi hàm catalog" cannot be done for `/`, `/products/[slug]`, related products or `/api/products/[slug]`. Two outcomes:

- Dev A adds `source` params to every catalog function. That is a signature change, which AD-8 tries to avoid.
- Dev B overlays *after* the call: `const p = getProductBySlug(slug); p.stock = levels[p.id]`. This **mutates the shared `products` array**. The live stock of one request leaks into every later request and into `placeOrder`'s `findProduct` (which still reads `product.stock`).
- **Fix (tighten AD-8):**
  - `withLiveStock` returns new objects and never mutates (enforce with `Object.freeze(products)` in `src/data/products.ts` under test).
  - Catalog lookup functions take an optional `source: readonly Product[] = products`, the same as `queryProducts`. Callers pass `withLiveStock(getAllProducts(), levels)`.
  - `placeOrder` must take stock **only** from `effectiveLevels(state.inventory)` inside the mutator. `findProduct` is used for name/price/slug only, and `Product.stock` is never read on the server write path.

### H6. Windows atomic-commit holes in tmp + fsync + rename

1. **`fsync` is not a path operation.** AD-5's fs port lists `writeFile`, `fsync`, `rename`. `fs/promises.writeFile(path)` closes the file, and `fsync` needs a `FileHandle`. Dev A writes `writeFile(tmp)` and then never fsyncs. Dev B opens, writes, syncs and closes. The fault-injection tests (AD-5a) then target different seams. **Fix:** the port is `{ open(path,'w') → { write, sync, close }, rename, readFile, rm }`, and the test cases name those exact steps.
2. **Windows rename EPERM/EBUSY.** On NTFS, `rename` over an existing file fails transiently with `EPERM`/`EACCES`/`EBUSY` when another handle is open on the target: antivirus, the Search indexer, or *our own* lock-free `read()` running concurrently (AD-4). This is the documented reason `graceful-fs` exists. Result: random 500s on staff confirm while the queue is refreshing. **Fix:** in the JSON adapter, retry `rename` on `EPERM|EACCES|EBUSY` with backoff (e.g. 10 tries, ≤ 1 s total) inside the mutex. On final failure, throw so that nothing is written (the state is consistent because rename is all-or-nothing). Also retry `readFile` on `EPERM|EBUSY`.
3. **Linux durability.** Without `fsync` on the **directory** after `rename`, a power loss can roll back to the old file after the client got 200. Atomicity holds, durability does not. **Fix:** on non-win32, open the directory and `sync()` after rename (skip on Windows, where it fails with EISDIR/EPERM). State the guarantee as "atomic always; durable after 200 on Linux".
4. **Fixed `.tmp` name.** This is fine in-process under the mutex. It becomes a clobber if a second process writes (see M1). Use `<file>.<pid>.<rand>.tmp` and clean `*.tmp` older than 1 minute at init.

### H7. Open redirect via `?next=`

AD-10 and AD-13 redirect to `/staff/login?next=<path>`, and after login the client navigates to `next`. Neither AD restricts it, so `next=//evil.example` or `next=https://evil.example` → phishing page right after a real PIN entry. **Fix:** accept `next` only if it matches `^/staff(/|$)` and does not start with `//`. Otherwise use `/staff`. Validate it on the server (login handler response) and on the client.

---

## Medium

### M1. "Single process" is assumed, not enforced; mutex keyed by unnormalized path

- AD-4 keys the mutex by "đường dẫn file tuyệt đối". On Windows, `D:\…\storage\shop-store.json` and `d:\…\Storage\shop-store.json` are the same file but two mutex keys. One instance can come from `path.resolve(process.env.STORE_FILE)` and another from a relative default resolved differently. **Fix:** key by `(await fs.realpath(dir)) + basename`, lower-cased on win32. Better: exactly one `ShopStore` instance per process, created in `store/server.ts` on `globalThis`, which every feature's `server.ts` imports. No feature constructs its own adapter.
- Nothing stops `npm run dev` and `npm start` (or an SM-2 reconciliation script, or a seed script) from writing the same `storage/shop-store.json`. That causes lost updates across processes. **Fix:** at first `update`, take an exclusive lockfile `shop-store.json.lock` (`open(…,'wx')` containing the pid; take over a stale lock if the pid is dead). On failure → 503 `STORE_LOCKED`. Scripts must go through `ShopStore` or run only when the server is stopped (state this in the AD).

### M2. Error-precedence and message gaps make FR-10 responses diverge

- **Precedence.** AD-6 does not order the two 409 checks. Request `{from:"delivered", to:"pending"}` on a `pending` order: Dev A (CAS first) returns "Đã chờ xác nhận bởi … lúc …", which is nonsensical. Dev B (table first) returns the invalid-pair error. **Fix:** order the checks: (1) Zod (400); (2) pair `from→to` ∈ table (409, generic message); (3) order exists (404); (4) CAS `status === from` (409 with actor message); (5) stock.
- **Message for the non-staff case.** "bởi ‹actor›" is undefined when the last change was by `{kind:"customer"}`, or when the order is legacy with no `statusHistory`. **Fix:** customer → "Đã hủy bởi khách lúc HH:mm"; no history → "Đơn đang ở trạng thái ‹nhãn›" without actor or time. `HH:mm` is in Asia/Ho_Chi_Minh and computed by a pure helper that receives the ISO time (no `Date.now()`).
- **`updatedAt`.** It is not stated whether transitions set `updatedAt`. AD-9's queue sort falls back to `updatedAt`, so one dev's omission changes another's ordering. **Fix:** every mutator that changes an order sets `updatedAt = now` (the same `now` as the history row).

### M3. Body schema discriminated on `to` cannot express rules that depend on `from`

AD-12 discriminates on `to`, but cancel rules depend on `from` (pending/confirmed → 4 reasons; shipping → `delivery_failed` + `returnedToShop:true`). A schema discriminated on `to` must encode `from` cross-field (superRefine). Dev A does that in Zod (400). Dev B validates reason-vs-from in the core table (409). FR-11/FR-12 require **400**. **Fix:** the body schema is a `z.union` over the six table rows, keyed by `(from,to)`, generated from `ORDER_TRANSITIONS` so UI, schema and core share one source. `returnedToShop:false` from `shipping` → 400.

### M4. Mutator copy semantics differ between adapters

AD-4 says "làm việc trên bản sao" but not *who* copies. If the JSON adapter passes a fresh parse (an implicit copy) while the in-memory adapter passes its live object, a mutator that mutates in place and then throws corrupts the in-memory store only. Tests and production then diverge. That undermines AD-5. **Fix:** both adapters `structuredClone` before calling the mutator and after returning `result`. Mutators are typed with `Readonly<ShopState>` input (deep readonly), and the in-memory store asserts this in dev.

### M5. Env access rule contradicts proxy needs

Conventions: env is read "chỉ trong `features/*/server.ts`". `proxy.ts` may import only the pure part of `staff` (no `server.ts`), but it needs `STAFF_SESSION_SECRET` and `STAFF_PINS` to verify the cookie (including "name vẫn còn trong STAFF_PINS"). Every implementation breaks one rule. **Fix:**
- Allow env reads in `staff/staff-config.ts`, which is pure, has no fs and is memoized.
- Or have `proxy.ts` pass `process.env` into `verifySession(cookie, config)`.
- Also state that `proxy.ts` uses the default Node runtime (needed for `node:crypto`). Setting `runtime = "edge"` is forbidden.

### M6. `staff/layout.tsx` and `/staff/login` loop

The login page lives under `staff/`, so it inherits `staff/layout.tsx`, which renders the Staff header (it needs the staff name). A dev who puts `requireStaff()` in the layout gets an infinite redirect on `/staff/login`. A dev who reads the session in the layout with a non-redirecting helper is fine. **Fix:** put login at `app/staff/(auth)/login` and the protected pages under `app/staff/(app)/` with their own layout. Alternatively, rule that `staff/layout.tsx` calls only `getStaffSession()` (non-redirecting). Page-level `requireStaff()` stays mandatory.

### M7. "Chỉ nhận `application/json`" is unenforced by existing code

The CSRF deferral relies on JSON-only bodies, but `readJsonBody` (`src/lib/http.ts:28`) calls `request.json()` regardless of `Content-Type`, so `text/plain` simple requests are accepted. `SameSite=Lax` covers cross-site cases, but the stated control does not exist. **Fix:** `readJsonBody` (or a `requireJson` wrapper for `/api/staff/**`) returns 415 unless the content type is `application/json`. Optionally also check `Origin` equals the host on staff mutations.

### M8. Ledger (FR-20) has two possible writers

The diagram puts "ledger ops" in `inventory`. AD-6 puts the ledger write in the orders mutator. Dev A makes `deduct/restock` return ledger rows. Dev B pushes rows in `transitionOrder`. Combined → **double entries**, and SM-2 fails. **Fix:** `deduct`/`restock` return `{ inventory, ledger: StockLedgerEntry[] }`. They are the only producers of ledger rows, and the mutator appends what they return. A seed row comes from materialization (C2).

---

## Low

- **L1. Session survives a PIN rotation.** Changing a PIN for the same name leaves old cookies valid for 12 h. Include `pinFingerprint = HMAC(secret, pin).slice(0,8)` in the payload and check it.
- **L2. The HMAC input is unspecified.** Specify "HMAC over the base64url payload string", so the proxy and the handler cannot differ. `session.ts` is shared, but tests should pin this.
- **L3. AD-14 ordering.** Verify Playwright's order of `globalSetup` and `webServer` start. If the server starts first, deleting `.e2e/` is still safe only because there is no cache, so state that dependency. Also add `.e2e/` and `storage/` to `.gitignore`; today neither is listed (`storage/orders.json` is currently unignored).
- **L4. `placeOrder` purity.** `generateId` and `now()` must be computed **before** `store.update` and passed into the mutator. Otherwise the "pure mutator" rule is broken by `crypto.randomUUID`. An id collision then surfaces as a 500 via the uniqueness invariant, which is acceptable but should be documented.
- **L5. Public `/orders` + unauthenticated FR-22.** Anyone can list every order id and file a cancel-request on any `confirmed` order. This is accepted by OQ-1 for viewing, but FR-22 turns it into a write. Require the customer's phone number in the FR-22 body, matched inside the mutator.
- **L6. `server-only` guard.** AD-1's client/server boundary is enforced only by convention. Add `import "server-only"` at the top of each `features/*/server.ts` (Next resolves it; confirm no new dependency is needed, otherwise use an ESLint `no-restricted-imports` rule for `**/server` from `"use client"` files).

---

## Proposed AD deltas (summary)

| # | Change | Closes |
|---|---|---|
| AD-4′ | Decisions only inside mutators; `read()` results never written back; façade `save` → insert-only `create`; adapters clone in/out; one store instance per process from `store/server.ts`; lockfile for cross-process exclusion; normalized path key | C1, M1, M4 |
| AD-8a (new) | `effectiveLevels(inventory, seed)` is the only accessor; materialize all keys + baseline on first update; `withLiveStock` non-mutating; catalog lookups take `source`; server never reads `Product.stock` | C2, H5 |
| AD-15′ | Schema = type source (`z.infer`), loose objects, round-trip test; legacy loader injected; `ensureInitialized` inside mutex with re-check; validate legacy, fail closed | C3, H1 |
| AD-3′/AD-5′ | FileHandle-based fs port; rename/read retry on EPERM/EACCES/EBUSY; dir fsync on POSIX; unique tmp names | H6 |
| AD-6′ | Check precedence; customer/legacy message fallbacks; `updatedAt` rule; schema union generated from `ORDER_TRANSITIONS` | M2, M3 |
| AD-10′/AD-11′ | HMAC-then-compare PINs; socket IP + `TRUSTED_PROXY_HOPS`; 6-digit minimum; global slowdown instead of hard lock; `next` allow-list; env in `staff-config.ts`; Node runtime for proxy; route groups for login; JSON content-type enforcement; PIN fingerprint | H2, H3, H7, M5, M6, M7, L1 |
| AD-13′/new | Combined views from one snapshot (`getQueueView`); single Đèn rule in `orders/stock-light.ts`; structural stock API | H4 |
| AD-20 (new, when FR-20 lands) | `deduct`/`restock` are sole ledger producers | M8 |
