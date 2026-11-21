import { promises as fsp } from "node:fs";
import path from "node:path";
import {
  assertShopStateInvariants,
  parseShopState,
  ShopStateError,
  type ShopState,
} from "./state-schema";

export interface ShopStateFileHandle {
  writeFile(data: string): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

/** Port hệ thống file — inject được để test chèn lỗi (AD-6). */
export interface ShopStateFs {
  /** Tạo thư mục (đệ quy, không lỗi nếu đã có). */
  mkdir(dir: string): Promise<void>;
  /** Mở file để ghi mới (cờ "w": tạo hoặc ghi đè). */
  open(file: string): Promise<ShopStateFileHandle>;
  rename(from: string, to: string): Promise<void>;
  /** Đọc UTF-8; file không tồn tại thì ném lỗi có `code: "ENOENT"`. */
  readFile(file: string): Promise<string>;
  fsyncDir(dir: string): Promise<void>;
}

export const defaultShopStateFs: ShopStateFs = {
  async mkdir(dir) {
    await fsp.mkdir(dir, { recursive: true });
  },
  async open(file) {
    const handle = await fsp.open(file, "w");
    return {
      writeFile: (data) => handle.writeFile(data, "utf8"),
      sync: () => handle.sync(),
      close: () => handle.close(),
    };
  },
  rename: (from, to) => fsp.rename(from, to),
  readFile: (file) => fsp.readFile(file, "utf8"),
  async fsyncDir(dir) {
    const handle = await fsp.open(dir, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
};

export interface ShopStateFileDeps {
  fs?: ShopStateFs;
  sleep?: (ms: number) => Promise<void>;
  platform?: NodeJS.Platform;
}

export interface ShopStateFile {
  /** Trả `null` khi file chưa tồn tại; ném `ShopStateError` khi file hỏng. */
  read(): Promise<ShopState | null>;
  /** Ghi nguyên tử: hoặc file mới hoàn chỉnh, hoặc file cũ còn nguyên. */
  commit(state: ShopState): Promise<void>;
}

const RETRYABLE_RENAME_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);
/** Windows có thể từ chối rename khi file đích đang được đọc; thử lại với backoff. */
export const RENAME_BACKOFF_MS = [20, 40, 80, 160, 320] as const;

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * File trạng thái `ShopState` (AD-3). Lớp thấp: không có khóa, không cache —
 * repository phía trên chịu trách nhiệm tuần tự hóa các lần đọc/ghi.
 */
export function createShopStateFile(filePath: string, deps: ShopStateFileDeps = {}): ShopStateFile {
  const fs = deps.fs ?? defaultShopStateFs;
  const sleep = deps.sleep ?? defaultSleep;
  const platform = deps.platform ?? process.platform;
  const dir = path.dirname(filePath);
  const tempFile = `${filePath}.tmp`;

  async function renameWithRetry(): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tempFile, filePath);
        return;
      } catch (error) {
        const retryable = RETRYABLE_RENAME_CODES.has(errorCode(error) ?? "");
        if (!retryable || attempt >= RENAME_BACKOFF_MS.length) throw error;
        await sleep(RENAME_BACKOFF_MS[attempt]);
      }
    }
  }

  return {
    async read() {
      let raw: string;
      try {
        raw = await fs.readFile(filePath);
      } catch (error) {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
      }

      let data: unknown;
      try {
        // Bỏ BOM nếu file từng được mở bằng trình soạn thảo trên Windows.
        data = JSON.parse(raw.replace(/^\uFEFF/, ""));
      } catch (error) {
        throw new ShopStateError(`File trạng thái ${filePath} không phải JSON hợp lệ`, {
          cause: error,
        });
      }
      const state = parseShopState(data, `File trạng thái ${filePath}`);
      assertShopStateInvariants(state);
      return state;
    },

    async commit(state) {
      parseShopState(state);
      assertShopStateInvariants(state);
      const data = JSON.stringify(state, null, 2);

      await fs.mkdir(dir);
      const handle = await fs.open(tempFile);
      let writeFailed = false;
      try {
        await handle.writeFile(data);
        await handle.sync();
      } catch (error) {
        writeFailed = true;
        throw error;
      } finally {
        try {
          await handle.close();
        } catch (closeError) {
          // Không để lỗi close che mất nguyên nhân gốc (EIO, ENOSPC…).
          if (!writeFailed) throw closeError;
        }
      }
      await renameWithRetry();
      if (platform !== "win32") {
        await fs.fsyncDir(dir);
      }
    },
  };
}
