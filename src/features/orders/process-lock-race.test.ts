// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimLockFile, lockFileFor, StoreLockedError } from "./process-lock";

const DEAD_PID = 999_999;
const isAlive = (pid: number) => pid !== DEAD_PID;

let dir: string;
let lockFile: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "shoplite-lock-race-"));
  lockFile = lockFileFor(path.join(dir, "shop-store.json"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("gỡ lock của tiến trình đã chết khi nhiều tiến trình cùng khởi động", () => {
  it("đúng một tiến trình giữ lock, file lock ghi PID của nó", async () => {
    for (let round = 0; round < 30; round++) {
      await writeFile(lockFile, String(DEAD_PID), "utf8");
      const pids = Array.from({ length: 8 }, (_, i) => 1000 + round * 10 + i);

      const results = await Promise.allSettled(
        pids.map((pid) => claimLockFile(lockFile, pid, isAlive)),
      );

      const winners = pids.filter((_, i) => results[i].status === "fulfilled");
      for (const result of results) {
        if (result.status === "rejected" && !(result.reason instanceof StoreLockedError))
          throw result.reason;
      }
      expect(winners, `vòng ${round}`).toHaveLength(1);
      expect((await readFile(lockFile, "utf8")).trim()).toBe(String(winners[0]));
      await rm(lockFile, { force: true });
    }
  });

  it("khóa phụ .takeover do tiến trình chết để lại không chặn mãi", async () => {
    await writeFile(lockFile, String(DEAD_PID), "utf8");
    await writeFile(`${lockFile}.takeover`, String(DEAD_PID), "utf8");

    await claimLockFile(lockFile, 4321, isAlive);

    expect((await readFile(lockFile, "utf8")).trim()).toBe("4321");
    expect(existsSync(`${lockFile}.takeover`)).toBe(false);
  });

  it("chủ lock còn sống → không gỡ, báo StoreLockedError có PID", async () => {
    await writeFile(lockFile, "4242", "utf8");
    await expect(claimLockFile(lockFile, 4321, isAlive)).rejects.toMatchObject({ ownerPid: 4242 });
    expect((await readFile(lockFile, "utf8")).trim()).toBe("4242");
  });
});
