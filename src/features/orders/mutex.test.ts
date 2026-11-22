// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMutex, fileMutexKey, getFileMutex } from "./mutex";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

describe("createMutex", () => {
  it("chạy các tác vụ lần lượt theo thứ tự gọi, không chồng lên nhau", async () => {
    const mutex = createMutex();
    const events: string[] = [];
    const task = (name: string) => async () => {
      events.push(`start:${name}`);
      await tick();
      events.push(`end:${name}`);
      return name;
    };

    const results = await Promise.all([
      mutex.runExclusive(task("a")),
      mutex.runExclusive(task("b")),
      mutex.runExclusive(task("c")),
    ]);

    expect(results).toEqual(["a", "b", "c"]);
    expect(events).toEqual(["start:a", "end:a", "start:b", "end:b", "start:c", "end:c"]);
  });

  it("tác vụ ném lỗi không làm kẹt khóa cho tác vụ sau", async () => {
    const mutex = createMutex();
    const failed = mutex.runExclusive(() => {
      throw new Error("boom");
    });
    const next = mutex.runExclusive(() => "ok");

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });
});

describe("createMutex — tác vụ async bị reject", () => {
  it("tác vụ async reject vẫn nhả khóa cho tác vụ sau", async () => {
    const mutex = createMutex();
    const failed = mutex.runExclusive(async () => {
      await tick();
      throw new Error("async boom");
    });
    const next = mutex.runExclusive(async () => "ok");

    await expect(failed).rejects.toThrow("async boom");
    await expect(next).resolves.toBe("ok");
  });
});

describe("getFileMutex", () => {
  it("cùng đường dẫn (tương đối hoặc tuyệt đối) trả cùng một mutex", () => {
    const relative = path.join("storage", "mutex-test-a.json");
    expect(getFileMutex(relative)).toBe(getFileMutex(path.resolve(relative)));
  });

  it("đường dẫn khác nhau trả mutex khác nhau", () => {
    expect(getFileMutex("storage/mutex-test-b.json")).not.toBe(
      getFileMutex("storage/mutex-test-c.json"),
    );
  });

  it("trên win32 khóa không phân biệt chữ hoa/thường; nền khác thì có", () => {
    const upper = path.resolve("Storage", "Mutex-Test-D.json");
    const lower = upper.toLowerCase();
    expect(fileMutexKey(upper, "win32")).toBe(fileMutexKey(lower, "win32"));
    expect(getFileMutex(upper, "win32")).toBe(getFileMutex(lower, "win32"));
    expect(fileMutexKey(upper, "linux")).not.toBe(fileMutexKey(lower, "linux"));
  });

  it("registry nằm trên globalThis nên dùng chung giữa các module instance", () => {
    const registry = (globalThis as Record<symbol, unknown>)[
      Symbol.for("shoplite.fileMutexes")
    ] as Map<string, unknown>;
    const mutex = getFileMutex("storage/mutex-test-e.json");
    expect(registry.get(fileMutexKey("storage/mutex-test-e.json"))).toBe(mutex);
  });
});
