import { randomUUID } from "node:crypto";
import { promises as fsp, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileMutexKey } from "./mutex";

/** Store đang được một tiến trình khác còn sống giữ (AD-5). */
export class StoreLockedError extends Error {
  readonly lockFile: string;
  /** `null` khi không xác định được chủ lock (lock đổi liên tục trong lúc thử). */
  readonly ownerPid: number | null;

  // Field khai báo tường minh (không dùng parameter properties) để chạy được bằng Node strip-types.
  constructor(lockFile: string, ownerPid: number | null) {
    super(
      (ownerPid === null
        ? `Không lấy được lock ${lockFile} sau nhiều lần thử. `
        : `Store đang được tiến trình PID ${ownerPid} sử dụng (${lockFile}). `) +
        "Chỉ chạy một server hoặc script trên một store; dừng tiến trình kia trước. " +
        "Nếu chắc chắn không còn tiến trình ShopLite nào chạy (ví dụ PID đã bị hệ điều hành cấp lại), " +
        "xóa file lock rồi khởi động lại.",
    );
    this.name = "StoreLockedError";
    this.lockFile = lockFile;
    this.ownerPid = ownerPid;
  }
}

export interface ProcessLockDeps {
  pid?: number;
  /** `true` nếu tiến trình còn sống. Mặc định dùng `process.kill(pid, 0)`. */
  isAlive?: (pid: number) => boolean;
  platform?: NodeJS.Platform;
}

function defaultIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: tiến trình tồn tại nhưng không có quyền gửi tín hiệu — vẫn coi là còn sống.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

interface HeldLock {
  lockFile: string;
  pid: number;
  ready: Promise<string>;
  acquired: boolean;
}

const REGISTRY_KEY = Symbol.for("shoplite.storeLocks");
type GlobalWithLocks = typeof globalThis & {
  [REGISTRY_KEY]?: { held: Map<string, HeldLock>; exitHookInstalled: boolean };
};

function registry() {
  const holder = globalThis as GlobalWithLocks;
  return (holder[REGISTRY_KEY] ??= { held: new Map(), exitHookInstalled: false });
}

export function lockFileFor(storeFile: string): string {
  return `${path.resolve(storeFile)}.lock`;
}

function parsePid(content: string): number | null {
  const text = content.trim();
  if (!/^\d+$/.test(text)) return null;
  const pid = Number(text);
  return pid > 0 ? pid : null;
}

/** Lỗi khi file đang bị tiến trình khác tạo/xóa (Windows trả EPERM/EACCES/EBUSY cho file đang xóa). */
const TRANSIENT_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

function isContended(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code ?? "";
  return code === "EEXIST" || (process.platform === "win32" && TRANSIENT_CODES.has(code));
}

/**
 * Tạo lock với nội dung đầy đủ trong một bước: ghi PID ra file tạm rồi `link` sang tên lock
 * (`link` thất bại với EEXIST nếu lock đã có). Người đọc không bao giờ thấy lock rỗng.
 */
async function createLockFile(lockFile: string, pid: number): Promise<boolean> {
  const temp = `${lockFile}.${pid}.${randomUUID()}.tmp`;
  await fsp.writeFile(temp, String(pid));
  try {
    await fsp.link(temp, lockFile);
    return true;
  } catch (error) {
    if (isContended(error)) return false;
    throw error;
  } finally {
    await fsp.rm(temp, { force: true });
  }
}

/** `undefined`: không có file lock; `null`: có file nhưng nội dung không phải PID. */
async function readLock(lockFile: string): Promise<number | null | undefined> {
  try {
    return parsePid(await fsp.readFile(lockFile, "utf8"));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    // ENOENT: không có lock. EPERM/EACCES/EBUSY (Windows): file đang bị xóa — coi như chưa thấy,
    // caller sẽ thử lại; mọi quyết định xóa đều đọc lại khi giữ khóa phụ nên vẫn an toàn.
    if (code === "ENOENT" || (process.platform === "win32" && TRANSIENT_CODES.has(code))) {
      return undefined;
    }
    throw error;
  }
}

async function readOwner(lockFile: string): Promise<number | null> {
  return (await readLock(lockFile)) ?? null;
}

const MAX_ATTEMPTS = 40;
const RETRY_DELAY_MS = 25;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gỡ lock của tiến trình đã chết, an toàn khi nhiều tiến trình cùng làm việc này.
 *
 * Nếu gỡ thẳng (`rm`) thì có race TOCTOU: B đọc thấy chủ cũ đã chết, A gỡ lock cũ và tạo lock mới,
 * rồi B xóa nhầm lock của A. Kết quả là hai tiến trình cùng giữ lock. Ở đây chỉ ai tạo được
 * `<lock>.takeover` mới được gỡ, và phải **đọc lại** chủ lock khi đang giữ khóa phụ đó. Lock chỉ
 * bị xóa ở đây, nên giữa lúc đọc lại và lúc xóa không ai thay được lock.
 */
async function removeStaleLock(lockFile: string, pid: number, isAlive: (pid: number) => boolean) {
  const guard = `${lockFile}.takeover`;
  if (!(await createLockFile(guard, pid))) {
    const guardOwner = await readLock(guard);
    if (guardOwner !== undefined && (guardOwner === null || !isAlive(guardOwner))) {
      // Khóa phụ của tiến trình chết giữa chừng (hiếm): bỏ nó rồi thử lại ngay.
      await fsp.rm(guard, { force: true });
      return;
    }
    // Có tiến trình khác đang gỡ (hoặc khóa phụ vừa bị xóa): chờ rồi thử lại từ đầu.
    await delay(RETRY_DELAY_MS);
    return;
  }
  try {
    const owner = await readLock(lockFile);
    if (owner !== undefined && owner !== pid && (owner === null || !isAlive(owner))) {
      await fsp.rm(lockFile, { force: true });
    }
  } finally {
    await fsp.rm(guard, { force: true });
  }
}

/** Lấy file lock cho `pid` (export để test tranh chấp giữa nhiều tiến trình). */
export async function claimLockFile(
  lockFile: string,
  pid: number,
  isAlive: (pid: number) => boolean,
): Promise<void> {
  await fsp.mkdir(path.dirname(lockFile), { recursive: true });
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (await createLockFile(lockFile, pid)) return;
    const owner = await readOwner(lockFile);
    if (owner === pid) return;
    if (owner !== null && isAlive(owner)) throw new StoreLockedError(lockFile, owner);
    // Lock của tiến trình đã chết (hoặc nội dung hỏng): gỡ có khóa phụ rồi thử tạo lại.
    await removeStaleLock(lockFile, pid, isAlive);
  }
  throw new StoreLockedError(lockFile, await readOwner(lockFile));
}

/**
 * Lấy PID lock `<storeFile>.lock` cho tiến trình hiện tại (AD-5). Gọi lười ở lần truy cập store
 * đầu tiên; các lần sau trong cùng tiến trình (nhiều repository, HMR) dùng lại kết quả.
 */
export function acquireStoreLock(storeFile: string, deps: ProcessLockDeps = {}): Promise<string> {
  const pid = deps.pid ?? process.pid;
  const isAlive = deps.isAlive ?? defaultIsAlive;
  const key = fileMutexKey(storeFile, deps.platform);
  const reg = registry();

  const existing = reg.held.get(key);
  if (existing) return existing.ready;

  const lockFile = lockFileFor(storeFile);
  const held: HeldLock = { lockFile, pid, acquired: false, ready: Promise.resolve(lockFile) };
  held.ready = claimLockFile(lockFile, pid, isAlive).then(
    () => {
      held.acquired = true;
      return lockFile;
    },
    (error: unknown) => {
      // Lấy lỗi thì không giữ trong registry, để lần sau thử lại (ví dụ tiến trình kia đã dừng).
      reg.held.delete(key);
      throw error;
    },
  );
  reg.held.set(key, held);
  installExitHook();
  return held.ready;
}

/**
 * Xóa mọi lock do tiến trình này đang giữ (đồng bộ, dùng được trong hook `exit`).
 * Chỉ xóa file còn ghi đúng PID của mình; lỗi khi xóa được bỏ qua.
 */
export function releaseStoreLocks(): void {
  const reg = registry();
  for (const held of reg.held.values()) unlinkIfOwned(held);
  reg.held.clear();
}

/** Thả lock của một store cụ thể (không đụng lock khác mà tiến trình đang giữ). */
export function releaseStoreLock(
  storeFile: string,
  platform: NodeJS.Platform = process.platform,
): void {
  const reg = registry();
  const key = fileMutexKey(storeFile, platform);
  const held = reg.held.get(key);
  if (!held) return;
  unlinkIfOwned(held);
  reg.held.delete(key);
}

function unlinkIfOwned(held: HeldLock): void {
  if (!held.acquired) return;
  try {
    if (parsePid(readFileSync(held.lockFile, "utf8")) === held.pid) unlinkSync(held.lockFile);
  } catch {
    // File đã mất hoặc không đọc được.
  }
}

function installExitHook() {
  const reg = registry();
  if (reg.exitHookInstalled) return;
  reg.exitHookInstalled = true;
  process.once("exit", releaseStoreLocks);
}
