import { randomUUID } from "node:crypto";
import { promises as fsp, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileMutexKey } from "./mutex";

/** Store đang được một tiến trình khác còn sống giữ (AD-5). */
export class StoreLockedError extends Error {
  constructor(
    readonly lockFile: string,
    /** `null` khi không xác định được chủ lock (lock đổi liên tục trong lúc thử). */
    readonly ownerPid: number | null,
  ) {
    super(
      (ownerPid === null
        ? `Không lấy được lock ${lockFile} sau nhiều lần thử. `
        : `Store đang được tiến trình PID ${ownerPid} sử dụng (${lockFile}). `) +
        "Chỉ chạy một server hoặc script trên một store; dừng tiến trình kia trước. " +
        "Nếu chắc chắn không còn tiến trình ShopLite nào chạy (ví dụ PID đã bị hệ điều hành cấp lại), " +
        "xóa file lock rồi khởi động lại.",
    );
    this.name = "StoreLockedError";
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
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    await fsp.rm(temp, { force: true });
  }
}

async function readOwner(lockFile: string): Promise<number | null> {
  try {
    return parsePid(await fsp.readFile(lockFile, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function takeLock(lockFile: string, pid: number, isAlive: (pid: number) => boolean) {
  await fsp.mkdir(path.dirname(lockFile), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    if (await createLockFile(lockFile, pid)) return;
    const owner = await readOwner(lockFile);
    if (owner === pid) return;
    if (owner !== null && isAlive(owner)) throw new StoreLockedError(lockFile, owner);
    // Lock của tiến trình đã chết (hoặc nội dung hỏng): gỡ rồi thử tạo lại một lần.
    await fsp.rm(lockFile, { force: true });
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
  held.ready = takeLock(lockFile, pid, isAlive).then(
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
  for (const held of reg.held.values()) {
    if (!held.acquired) continue;
    try {
      if (parsePid(readFileSync(held.lockFile, "utf8")) === held.pid) unlinkSync(held.lockFile);
    } catch {
      // File đã mất hoặc không đọc được.
    }
  }
  reg.held.clear();
}

function installExitHook() {
  const reg = registry();
  if (reg.exitHookInstalled) return;
  reg.exitHookInstalled = true;
  process.once("exit", releaseStoreLocks);
}
