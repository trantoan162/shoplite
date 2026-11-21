import path from "node:path";

/** Khóa trong tiến trình: các tác vụ chạy lần lượt theo thứ tự gọi. */
export interface Mutex {
  runExclusive<T>(task: () => Promise<T> | T): Promise<T>;
}

export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    runExclusive(task) {
      const run = tail.then(task);
      // Tác vụ lỗi không được làm kẹt hàng đợi.
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

const REGISTRY_KEY = Symbol.for("shoplite.fileMutexes");

type GlobalWithRegistry = typeof globalThis & {
  [REGISTRY_KEY]?: Map<string, Mutex>;
};

/** Khóa của một file: mọi repository mở cùng đường dẫn dùng chung một mutex (AD-4). */
export function fileMutexKey(file: string, platform: NodeJS.Platform = process.platform): string {
  const resolved = path.resolve(file);
  return platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function getFileMutex(file: string, platform: NodeJS.Platform = process.platform): Mutex {
  const holder = globalThis as GlobalWithRegistry;
  const registry = (holder[REGISTRY_KEY] ??= new Map<string, Mutex>());
  const key = fileMutexKey(file, platform);
  let mutex = registry.get(key);
  if (!mutex) {
    mutex = createMutex();
    registry.set(key, mutex);
  }
  return mutex;
}
