// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { defaultShopStateFs } from "./shop-state-file";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrderError } from "./order-errors";
import {
  createInMemoryOrderRepository,
  createJsonFileOrderRepository,
  InjectedCommitError,
  createJsonFileShopRepository,
  emptyShopState,
  type OrderRepository,
} from "./order-repository";
import { ShopStateError } from "./state-schema";
import type { Order } from "./types";

const sampleOrder = (id: string): Order => ({
  id,
  status: "pending",
  createdAt: "2026-11-21T01:00:00.000Z",
  updatedAt: "2026-11-21T01:00:00.000Z",
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

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "shoplite-repo-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Dựng repository đã có sẵn một đơn `SL-1` và tồn kho `p001 = 5`. */
type Factory = () => Promise<OrderRepository>;

const adapters: [string, Factory][] = [
  [
    "in-memory",
    async () =>
      createInMemoryOrderRepository([sampleOrder("SL-1")], {
        inventory: { p001: 5 },
      }),
  ],
  [
    "file trạng thái",
    async () => {
      const repository = createJsonFileShopRepository(path.join(dir, "shop-store.json"));
      await repository.update((state) => ({
        state: {
          ...state,
          orders: [sampleOrder("SL-1")],
          inventory: { p001: 5 },
          inventoryBaseline: { p001: 5 },
        },
        result: undefined,
      }));
      return repository;
    },
  ],
];

describe.each(adapters)("OrderRepository (%s)", (_name, makeRepository) => {
  it("update tuần tự: mutator thứ hai thấy kết quả của mutator thứ nhất", async () => {
    const repository = await makeRepository();
    const seen: number[] = [];
    const decrement = () =>
      repository.update((state) => {
        seen.push(state.inventory.p001);
        state.inventory.p001 -= 1;
        return { state, result: state.inventory.p001 };
      });

    const results = await Promise.all([decrement(), decrement(), decrement()]);

    expect(seen).toEqual([5, 4, 3]);
    expect(results).toEqual([4, 3, 2]);
    const state = await repository.readState();
    expect(state.inventory.p001).toBe(2);
    // inventory và inventoryBaseline là hai object độc lập.
    expect(state.inventoryBaseline.p001).toBe(5);
  });

  it("mutator ném OrderError: update reject đúng lỗi đó, không ghi, lần sau vẫn chạy", async () => {
    const repository = await makeRepository();
    const error = new OrderError("ORDER_NOT_FOUND", "không có");

    await expect(
      repository.update(() => {
        throw error;
      }),
    ).rejects.toBe(error);

    await repository.save(sampleOrder("SL-2"));
    expect((await repository.findAll()).map((order) => order.id)).toEqual(["SL-1", "SL-2"]);
  });

  it("mutator sửa state tại chỗ rồi ném: state giữ nguyên", async () => {
    const repository = await makeRepository();
    const before = await repository.readState();

    await expect(
      repository.update((state) => {
        state.orders[0].status = "cancelled";
        state.inventory.p001 = 0;
        throw new Error("đổi ý");
      }),
    ).rejects.toThrow("đổi ý");

    expect(await repository.readState()).toEqual(before);
  });

  it("mutator trả về tồn kho âm: reject ShopStateError, không ghi", async () => {
    const repository = await makeRepository();

    await expect(
      repository.update((state) => {
        state.inventory.p001 = -1;
        return { state, result: undefined };
      }),
    ).rejects.toThrow(ShopStateError);
    expect((await repository.readState()).inventory.p001).toBe(5);
  });

  it("readState trả bản sao: sửa bản đọc không đổi dữ liệu lưu", async () => {
    const repository = await makeRepository();
    const state = await repository.readState();
    state.orders[0].status = "delivered";
    state.inventory.p001 = 99;

    expect(await repository.readState()).toMatchObject({
      inventory: { p001: 5 },
    });
    expect((await repository.findById("SL-1"))?.status).toBe("pending");
  });

  it("save: thêm mới và cập nhật theo id", async () => {
    const repository = await makeRepository();
    await repository.save({ ...sampleOrder("SL-1"), status: "cancelled" });
    await repository.save(sampleOrder("SL-2"));

    const orders = await repository.findAll();
    expect(orders.map((order) => [order.id, order.status])).toEqual([
      ["SL-1", "cancelled"],
      ["SL-2", "pending"],
    ]);
  });
});

describe("createInMemoryOrderRepository", () => {
  it("failNextCommit: update đầu reject, state không đổi, lần sau thành công", async () => {
    const repository = createInMemoryOrderRepository([sampleOrder("SL-1")], {
      failNextCommit: true,
    });

    await expect(repository.save(sampleOrder("SL-2"))).rejects.toBeInstanceOf(InjectedCommitError);
    expect((await repository.findAll()).map((order) => order.id)).toEqual(["SL-1"]);

    await repository.save(sampleOrder("SL-2"));
    expect((await repository.findAll()).map((order) => order.id)).toEqual(["SL-1", "SL-2"]);
  });

  it("seed vi phạm bất biến (trùng mã đơn) báo lỗi ngay khi dựng", () => {
    expect(() => createInMemoryOrderRepository([sampleOrder("SL-1"), sampleOrder("SL-1")])).toThrow(
      ShopStateError,
    );
  });

  it("commit đơn sai schema bị từ chối như adapter file", async () => {
    const repository = createInMemoryOrderRepository();
    await expect(
      repository.save({ ...sampleOrder("SL-1"), status: "lost" } as unknown as Order),
    ).rejects.toThrow(ShopStateError);
  });

  it("gọi không tham số vẫn chạy như cũ (tồn kho rỗng)", async () => {
    expect(await createInMemoryOrderRepository().readState()).toEqual(emptyShopState());
  });
});

describe("createJsonFileShopRepository", () => {
  it("file chưa tồn tại: readState trả state rỗng và không tạo file", async () => {
    const file = path.join(dir, "nested", "shop-store.json");
    const repository = createJsonFileShopRepository(file);

    expect(await repository.readState()).toEqual(emptyShopState());
    expect(existsSync(path.dirname(file))).toBe(false);
  });

  it("hai instance mở cùng file dùng chung mutex, không mất cập nhật", async () => {
    const file = path.join(dir, "shop-store.json");
    const first = createJsonFileShopRepository(file);
    const second = createJsonFileShopRepository(file);
    await first.update((state) => ({
      state: {
        ...state,
        inventory: { p001: 10 },
        inventoryBaseline: { p001: 10 },
      },
      result: undefined,
    }));

    const decrement = (repository: OrderRepository) =>
      repository.update((state) => {
        state.inventory.p001 -= 1;
        return { state, result: undefined };
      });
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => decrement(i % 2 === 0 ? first : second)),
    );

    expect((await second.readState()).inventory.p001).toBe(0);
  });
});

describe("createJsonFileShopRepository — khóa sau lỗi và đường dẫn khác hoa/thường", () => {
  it("commit lỗi (rename EIO): update reject, khóa được nhả, lần sau thành công", async () => {
    const file = path.join(dir, "shop-store.json");
    let failOnce = true;
    const repository = createJsonFileShopRepository(file, {
      fs: {
        ...defaultShopStateFs,
        rename: (from, to) => {
          if (failOnce) {
            failOnce = false;
            return Promise.reject(Object.assign(new Error("EIO"), { code: "EIO" }));
          }
          return defaultShopStateFs.rename(from, to);
        },
      },
    });

    await expect(repository.save(sampleOrder("SL-1"))).rejects.toThrow("EIO");
    await repository.save(sampleOrder("SL-2"));
    expect((await repository.findAll()).map((order) => order.id)).toEqual(["SL-2"]);
  });

  it.runIf(process.platform === "win32")(
    "win32: hai instance trên đường dẫn khác hoa/thường dùng chung khóa, không mất cập nhật",
    async () => {
      const file = path.join(dir, "shop-store.json");
      const lower = createJsonFileShopRepository(file.toLowerCase());
      const upper = createJsonFileShopRepository(file.toUpperCase());
      await lower.update((state) => ({
        state: { ...state, inventory: { p001: 10 }, inventoryBaseline: { p001: 10 } },
        result: undefined,
      }));

      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          (i % 2 === 0 ? lower : upper).update((state) => {
            state.inventory.p001 -= 1;
            return { state, result: undefined };
          }),
        ),
      );

      expect((await upper.readState()).inventory.p001).toBe(0);
    },
  );
});

describe("createJsonFileOrderRepository (cầu nối orders.json)", () => {
  it("hai instance trên cùng orders.json dùng chung khóa, không mất đơn", async () => {
    const file = path.join(dir, "orders.json");
    const first = createJsonFileOrderRepository(file);
    const second = createJsonFileOrderRepository(file);

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (i % 2 === 0 ? first : second).save(sampleOrder(`SL-${i}`)),
      ),
    );

    expect(await second.findAll()).toHaveLength(10);
  });

  it("update chỉ ghi lại orders dưới dạng mảng như cũ", async () => {
    const file = path.join(dir, "orders.json");
    const repository = createJsonFileOrderRepository(file);
    await repository.save(sampleOrder("SL-1"));

    await repository.update((state) => {
      state.orders[0].status = "cancelled";
      return { state, result: undefined };
    });

    const raw = JSON.parse(await readFile(file, "utf8"));
    expect(Array.isArray(raw)).toBe(true);
    expect(raw).toHaveLength(1);
    expect(raw[0].status).toBe("cancelled");
  });

  it("đồng thời 10 save khác id: không mất đơn nào", async () => {
    const repository = createJsonFileOrderRepository(path.join(dir, "orders.json"));
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => repository.save(sampleOrder(`SL-${i}`))),
    );
    expect(await repository.findAll()).toHaveLength(10);
  });
});
