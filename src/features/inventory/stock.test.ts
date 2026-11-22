import { describe, expect, it } from "vitest";
import { availableStock, checkShortfall, declaredStock, reconcileInventoryKeys } from "./stock";

describe("declaredStock", () => {
  it.each([
    [5, 5],
    [0, 0],
    [-3, 0],
    [1.5, 0],
    [Number.NaN, 0],
  ])("stock %s → %s", (stock, expected) => {
    expect(declaredStock({ stock })).toBe(expected);
  });
});

describe("availableStock", () => {
  it("có key thì dùng giá trị trong inventory, kể cả 0", () => {
    expect(availableStock({ p1: 0 }, "p1", 40)).toBe(0);
    expect(availableStock({ p1: 3 }, "p1", 40)).toBe(3);
  });

  it("không có key thì dùng fallback (mặc định 0)", () => {
    expect(availableStock({}, "p1", 40)).toBe(40);
    expect(availableStock({}, "p1")).toBe(0);
  });

  it("không bị lừa bởi key kế thừa từ prototype", () => {
    expect(availableStock({}, "toString", 7)).toBe(7);
  });
});

describe("checkShortfall", () => {
  it("đủ hàng → mảng rỗng", () => {
    expect(checkShortfall([{ productId: "x", quantity: 2 }], { x: 2 })).toEqual([]);
  });

  it("thiếu hàng → liệt kê từng dòng cần/còn/thiếu; dòng trùng sản phẩm được cộng dồn", () => {
    expect(
      checkShortfall(
        [
          { productId: "x", quantity: 1 },
          { productId: "y", quantity: 1 },
          { productId: "x", quantity: 2 },
        ],
        { x: 1, y: 5 },
      ),
    ).toEqual([{ productId: "x", needed: 3, available: 1, missing: 2 }]);
  });

  it("fallback cho sản phẩm không có key", () => {
    expect(checkShortfall([{ productId: "z", quantity: 3 }], {}, () => 5)).toEqual([]);
  });

  it("sản phẩm không có trong inventory được coi là tồn 0", () => {
    expect(checkShortfall([{ productId: "z", quantity: 1 }], {})).toEqual([
      { productId: "z", needed: 1, available: 0, missing: 1 },
    ]);
  });
});

describe("reconcileInventoryKeys", () => {
  const products = [
    { id: "p1", stock: 10 },
    { id: "p2", stock: 4 },
    { id: "p3", stock: -1 },
  ];

  it("thêm sản phẩm mới vào cả inventory và baseline; giữ nguyên key cũ và id thừa", () => {
    const levels = {
      inventory: { p1: 2, gone: 7 },
      inventoryBaseline: { p1: 10, gone: 7 },
      orders: ["giữ nguyên"],
    };

    const result = reconcileInventoryKeys(levels, products);

    expect(result.inventory).toEqual({ p1: 2, gone: 7, p2: 4, p3: 0 });
    expect(result.inventoryBaseline).toEqual({ p1: 10, gone: 7, p2: 4, p3: 0 });
    expect(result.orders).toEqual(["giữ nguyên"]);
  });

  it("không sửa object đầu vào và hai map kết quả độc lập", () => {
    const levels = { inventory: {}, inventoryBaseline: {} };
    const result = reconcileInventoryKeys(levels, products);

    expect(levels).toEqual({ inventory: {}, inventoryBaseline: {} });
    expect(result.inventory).not.toBe(result.inventoryBaseline);
    expect(
      Object.values(result.inventory as Record<string, number>).every(
        (v) => Number.isInteger(v) && v >= 0,
      ),
    ).toBe(true);
  });
});
