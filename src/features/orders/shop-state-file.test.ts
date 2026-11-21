// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createShopStateFile,
  defaultShopStateFs,
  RENAME_BACKOFF_MS,
  type ShopStateFs,
} from "./shop-state-file";
import { ShopStateError, type ShopState } from "./state-schema";
import type { Order } from "./types";

const sampleOrder = (
  id: string,
  status: Order["status"] = "pending",
): Order => ({
  id,
  status,
  createdAt: "2026-11-20T14:40:00.000Z",
  updatedAt: "2026-11-20T14:40:00.000Z",
  customer: {
    fullName: "Lê Văn Minh",
    phone: "0901234567",
    address: "1 Trần Phú, Hà Nội",
  },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
});

const stateA = (): ShopState => ({
  schemaVersion: 1,
  orders: [sampleOrder("SL-1")],
  inventory: { p001: 5, p002: 3 },
  inventoryBaseline: { p001: 5, p002: 3 },
});

const stateB = (): ShopState => ({
  ...stateA(),
  orders: [sampleOrder("SL-1", "confirmed")],
  inventory: { p001: 3, p002: 2 },
});

function errno(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}

const fakeSleep = () =>
  vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

/** Bọc mọi hàm ghi của port bằng spy để kiểm tra "không đụng đĩa". */
const spyWrites = () => ({
  ...defaultShopStateFs,
  mkdir: vi.fn(defaultShopStateFs.mkdir),
  open: vi.fn(defaultShopStateFs.open),
  rename: vi.fn(defaultShopStateFs.rename),
  fsyncDir: vi.fn(defaultShopStateFs.fsyncDir),
});

const expectNoWrites = (fs: ReturnType<typeof spyWrites>) => {
  expect(fs.mkdir).not.toHaveBeenCalled();
  expect(fs.open).not.toHaveBeenCalled();
  expect(fs.rename).not.toHaveBeenCalled();
  expect(fs.fsyncDir).not.toHaveBeenCalled();
};

describe("createShopStateFile", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-state-"));
    file = path.join(dir, "nested", "shop-store.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("trả null khi file chưa tồn tại", async () => {
    expect(await createShopStateFile(file).read()).toBeNull();
  });

  it("tạo thư mục, ghi rồi đọc lại đúng trạng thái", async () => {
    const store = createShopStateFile(file);
    await store.commit(stateA());
    expect(await store.read()).toEqual(stateA());
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(stateA());
  });

  it.each(["writeFile", "sync", "rename"] as const)(
    "lỗi ở %s: file cũ còn nguyên từng byte và lần khởi động lại đọc ra trạng thái cũ",
    async (failAt) => {
      await createShopStateFile(file).commit(stateA());
      const before = await readFile(file);

      const failingFs: ShopStateFs = {
        ...defaultShopStateFs,
        async open(target) {
          const handle = await defaultShopStateFs.open(target);
          return {
            ...handle,
            writeFile:
              failAt === "writeFile"
                ? () => Promise.reject(errno("EIO"))
                : handle.writeFile,
            sync:
              failAt === "sync"
                ? () => Promise.reject(errno("EIO"))
                : handle.sync,
          };
        },
        rename:
          failAt === "rename"
            ? () => Promise.reject(errno("EIO"))
            : defaultShopStateFs.rename,
      };

      await expect(
        createShopStateFile(file, { fs: failingFs }).commit(stateB()),
      ).rejects.toThrow("EIO");
      expect(await readFile(file)).toEqual(before);
      // Repository mới trên cùng file = mô phỏng khởi động lại.
      expect(await createShopStateFile(file).read()).toEqual(stateA());
    },
  );

  it.each(["EPERM", "EACCES", "EBUSY"])(
    "rename bị %s hai lần rồi thành công thì commit thành công",
    async (code) => {
      const rename = vi
        .fn<ShopStateFs["rename"]>()
        .mockRejectedValueOnce(errno(code))
        .mockRejectedValueOnce(errno(code))
        .mockImplementation(defaultShopStateFs.rename);
      const sleep = fakeSleep();

      await createShopStateFile(file, {
        fs: { ...defaultShopStateFs, rename },
        sleep,
      }).commit(stateA());

      expect(rename).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([20, 40]);
      expect(await createShopStateFile(file).read()).toEqual(stateA());
    },
  );

  it("hết số lần thử (EBUSY liên tục) thì ném lỗi, file cũ còn nguyên", async () => {
    await createShopStateFile(file).commit(stateA());
    const before = await readFile(file);
    const rename = vi
      .fn<ShopStateFs["rename"]>()
      .mockRejectedValue(errno("EBUSY"));
    const sleep = fakeSleep();

    await expect(
      createShopStateFile(file, {
        fs: { ...defaultShopStateFs, rename },
        sleep,
      }).commit(stateB()),
    ).rejects.toMatchObject({ code: "EBUSY" });

    expect(rename).toHaveBeenCalledTimes(1 + RENAME_BACKOFF_MS.length);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([...RENAME_BACKOFF_MS]);
    expect(await readFile(file)).toEqual(before);
  });

  it("lỗi rename không thuộc nhóm thử lại (ENOSPC) thì ném ngay", async () => {
    const rename = vi
      .fn<ShopStateFs["rename"]>()
      .mockRejectedValue(errno("ENOSPC"));
    const sleep = fakeSleep();

    await expect(
      createShopStateFile(file, {
        fs: { ...defaultShopStateFs, rename },
        sleep,
      }).commit(stateA()),
    ).rejects.toMatchObject({ code: "ENOSPC" });
    expect(rename).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("bỏ qua file .tmp sót lại khi đọc và ghi đè nó ở lần commit sau", async () => {
    const store = createShopStateFile(file);
    await store.commit(stateA());
    await writeFile(`${file}.tmp`, "{ rác từ lần chết trước", "utf8");

    expect(await store.read()).toEqual(stateA());
    await store.commit(stateB());
    expect(await store.read()).toEqual(stateB());
  });

  it("giữ nguyên trường lạ qua vòng đọc → ghi → đọc", async () => {
    const withExtras = {
      ...stateA(),
      extra: { from: "story khác" },
      orders: [{ ...sampleOrder("SL-1"), foo: 1 }],
    } as unknown as ShopState;
    const store = createShopStateFile(file);
    await store.commit(withExtras);

    const loaded = await store.read();
    await store.commit(loaded!);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(withExtras);
  });

  it.each([
    ["JSON sai cú pháp", "{ not json"],
    ["schemaVersion khác 1", JSON.stringify({ ...stateA(), schemaVersion: 2 })],
    [
      "thiếu orders",
      JSON.stringify({
        schemaVersion: 1,
        inventory: {},
        inventoryBaseline: {},
      }),
    ],
  ])(
    "file hỏng (%s): read ném ShopStateError và không ghi gì",
    async (_label, content) => {
      await createShopStateFile(file).commit(stateA());
      await writeFile(file, content, "utf8");
      const spyFs = spyWrites();

      await expect(
        createShopStateFile(file, { fs: spyFs }).read(),
      ).rejects.toThrow(ShopStateError);
      expectNoWrites(spyFs);
      expect(await readFile(file, "utf8")).toBe(content);
      expect(existsSync(`${file}.tmp`)).toBe(false);
    },
  );

  it.each([
    ["tồn kho âm", { ...stateA(), inventory: { p001: -1 } }],
    ["tồn kho số lẻ", { ...stateA(), inventory: { p001: 1.5 } }],
    [
      "trùng mã đơn",
      { ...stateA(), orders: [sampleOrder("SL-1"), sampleOrder("SL-1")] },
    ],
  ])(
    "bất biến sai (%s): commit ném lỗi và không đụng đĩa",
    async (_label, state) => {
      const spyFs = spyWrites();

      await expect(
        createShopStateFile(file, { fs: spyFs }).commit(state),
      ).rejects.toThrow(ShopStateError);
      expectNoWrites(spyFs);
      expect(existsSync(path.dirname(file))).toBe(false);
    },
  );

  it.each([
    ["tồn kho âm", { ...stateA(), inventory: { p001: -1 } }],
    [
      "trùng mã đơn",
      { ...stateA(), orders: [sampleOrder("SL-1"), sampleOrder("SL-1")] },
    ],
  ])(
    "file trên đĩa vi phạm bất biến (%s): read ném ShopStateError",
    async (_label, state) => {
      await createShopStateFile(file).commit(stateA());
      await writeFile(file, JSON.stringify(state), "utf8");

      await expect(createShopStateFile(file).read()).rejects.toThrow(
        ShopStateError,
      );
    },
  );

  it("đọc được file có BOM UTF-8", async () => {
    await createShopStateFile(file).commit(stateA());
    await writeFile(file, "\uFEFF" + JSON.stringify(stateA()), "utf8");

    expect(await createShopStateFile(file).read()).toEqual(stateA());
  });

  it("lỗi đọc khác ENOENT (EACCES) được ném lên, không trả null", async () => {
    const readFileFails = vi
      .fn<ShopStateFs["readFile"]>()
      .mockRejectedValue(errno("EACCES"));

    await expect(
      createShopStateFile(file, {
        fs: { ...defaultShopStateFs, readFile: readFileFails },
      }).read(),
    ).rejects.toMatchObject({ code: "EACCES" });
  });

  it("writeFile lỗi và close cũng lỗi: giữ nguyên lỗi gốc", async () => {
    const failingFs: ShopStateFs = {
      ...defaultShopStateFs,
      async open(target) {
        const handle = await defaultShopStateFs.open(target);
        return {
          writeFile: () => Promise.reject(errno("ENOSPC")),
          sync: handle.sync,
          close: async () => {
            await handle.close();
            throw errno("EBADF");
          },
        };
      },
    };

    await expect(
      createShopStateFile(file, { fs: failingFs }).commit(stateA()),
    ).rejects.toMatchObject({ code: "ENOSPC" });
  });

  it("chỉ close lỗi (ghi thành công) thì lỗi close được ném lên", async () => {
    const failingFs: ShopStateFs = {
      ...defaultShopStateFs,
      async open(target) {
        const handle = await defaultShopStateFs.open(target);
        return {
          ...handle,
          close: async () => {
            await handle.close();
            throw errno("EIO");
          },
        };
      },
    };

    await expect(
      createShopStateFile(file, { fs: failingFs }).commit(stateA()),
    ).rejects.toMatchObject({ code: "EIO" });
  });

  it("trên win32 không fsync thư mục; nền khác thì có", async () => {
    const fsyncDir = vi
      .fn<ShopStateFs["fsyncDir"]>()
      .mockResolvedValue(undefined);
    const fs = { ...defaultShopStateFs, fsyncDir };

    await createShopStateFile(file, { fs, platform: "win32" }).commit(stateA());
    expect(fsyncDir).not.toHaveBeenCalled();

    await createShopStateFile(file, { fs, platform: "linux" }).commit(stateA());
    expect(fsyncDir).toHaveBeenCalledWith(path.dirname(file));
  });

  it("thứ tự commit: mkdir → ghi .tmp → sync → close → rename → fsyncDir", async () => {
    const calls: string[] = [];
    const fs: ShopStateFs = {
      mkdir: async (d) => {
        calls.push("mkdir");
        await defaultShopStateFs.mkdir(d);
      },
      async open(target) {
        calls.push(`open:${path.basename(target)}`);
        const handle = await defaultShopStateFs.open(target);
        return {
          writeFile: async (data) => {
            calls.push("writeFile");
            await handle.writeFile(data);
          },
          sync: async () => {
            calls.push("sync");
            await handle.sync();
          },
          close: async () => {
            calls.push("close");
            await handle.close();
          },
        };
      },
      rename: async (from, to) => {
        calls.push("rename");
        await defaultShopStateFs.rename(from, to);
      },
      readFile: defaultShopStateFs.readFile,
      fsyncDir: async () => {
        calls.push("fsyncDir");
      },
    };

    await createShopStateFile(file, { fs, platform: "linux" }).commit(stateA());
    expect(calls).toEqual([
      "mkdir",
      "open:shop-store.json.tmp",
      "writeFile",
      "sync",
      "close",
      "rename",
      "fsyncDir",
    ]);
  });
});
