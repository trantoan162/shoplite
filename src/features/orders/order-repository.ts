import { promises as fs } from "node:fs";
import path from "node:path";
import { createMutex, getFileMutex, type Mutex } from "./mutex";
import { acquireStoreLock, type ProcessLockDeps } from "./process-lock";
import { createShopStateFile, type ShopStateFileDeps } from "./shop-state-file";
import { assertShopStateInvariants, parseShopState, type ShopState } from "./state-schema";
import type { Order } from "./types";

/** Kết quả của một mutator: trạng thái mới và giá trị trả về cho caller. */
export interface StateMutation<T> {
  state: ShopState;
  result: T;
}

/**
 * Nơi lưu trữ đơn hàng và tồn kho (AD-4). Mọi phương thức chạy trong một mutex dùng chung
 * theo file, nên mọi quyết định trên dữ liệu hiện có phải nằm trong `update`.
 */
export interface OrderRepository {
  findAll(): Promise<Order[]>;
  findById(id: string): Promise<Order | null>;
  /** Thêm mới hoặc cập nhật (theo id). Production chỉ dùng để thêm đơn mới. */
  save(order: Order): Promise<void>;
  /** Bản sao toàn bộ trạng thái hiện tại. */
  readState(): Promise<ShopState>;
  /**
   * Đọc → mutator → kiểm bất biến → ghi, trong cùng một lần giữ khóa.
   * Mutator phải đồng bộ, thuần; nhận bản sao; ném lỗi thì không ghi gì.
   */
  update<T>(mutator: (state: ShopState) => StateMutation<T>): Promise<T>;
}

export const DEFAULT_ORDERS_FILE = path.join(process.cwd(), "storage", "orders.json");
export const DEFAULT_STORE_FILE = path.join(process.cwd(), "storage", "shop-store.json");

export function emptyShopState(): ShopState {
  return { schemaVersion: 1, orders: [], inventory: {}, inventoryBaseline: {} };
}

interface StateRepositoryParts {
  mutex: Mutex;
  load(): Promise<ShopState>;
  persist(state: ShopState): Promise<void>;
}

/** Lõi chung của mọi adapter: khóa, bản sao và bất biến chỉ nằm ở đây. */
function createStateRepository({ mutex, load, persist }: StateRepositoryParts): OrderRepository {
  const readState = () => mutex.runExclusive(async () => structuredClone(await load()));

  async function update<T>(mutator: (state: ShopState) => StateMutation<T>): Promise<T> {
    return mutex.runExclusive(async () => {
      const { state, result } = mutator(structuredClone(await load()));
      assertShopStateInvariants(state);
      await persist(state);
      return result;
    });
  }

  return {
    readState,
    update,
    async findAll() {
      return (await readState()).orders;
    },
    async findById(id) {
      return (await readState()).orders.find((order) => order.id === id) ?? null;
    },
    async save(order) {
      await update((state) => {
        const index = state.orders.findIndex((item) => item.id === order.id);
        if (index >= 0) {
          state.orders[index] = structuredClone(order);
        } else {
          state.orders.push(structuredClone(order));
        }
        return { state, result: undefined };
      });
    },
  };
}

export interface ShopRepositoryDeps extends ShopStateFileDeps {
  /**
   * Dựng trạng thái đầu tiên khi store chưa tồn tại (AD-15). Chạy trong mutex, sau khi đã đọc lại
   * file, nên chỉ chạy một lần; kết quả được commit trước khi trả về. Không có thì store chưa tồn
   * tại được đọc là trạng thái rỗng và không tạo file.
   */
  initialize?: () => Promise<ShopState>;
  /** PID lock `<file>.lock` (AD-5), lấy lười ở lần truy cập đầu. Mặc định bật. */
  lock?: boolean | ProcessLockDeps;
}

/** File trạng thái chung `ShopState` (AD-3, AD-4). Tạo repository không đụng đĩa. */
export function createJsonFileShopRepository(
  filePath: string,
  { initialize, lock = true, ...fileDeps }: ShopRepositoryDeps = {},
): OrderRepository {
  const file = createShopStateFile(filePath, fileDeps);
  // Lock dùng cùng quy tắc khóa (platform) với mutex của file.
  const lockDeps =
    lock === false ? false : { platform: fileDeps.platform, ...(lock === true ? {} : lock) };

  return createStateRepository({
    mutex: getFileMutex(filePath, fileDeps.platform),
    async load() {
      if (lockDeps) await acquireStoreLock(filePath, lockDeps);
      const existing = await file.read();
      if (existing) return existing;
      if (!initialize) return emptyShopState();
      const state = await initialize();
      await file.commit(state);
      return state;
    },
    persist: (state) => file.commit(state),
  });
}

/**
 * File `orders.json` cũ (mảng `Order[]`). Từ Story 1.4 không còn caller production: đơn cũ được
 * nhập vào store bằng `importLegacyOrders`. Không lưu tồn kho — ghi chỉ giữ lại `orders`.
 */
export function createJsonFileOrderRepository(filePath: string): OrderRepository {
  async function readAll(): Promise<Order[]> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const data: unknown = JSON.parse(raw);
      return Array.isArray(data) ? (data as Order[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeAll(orders: Order[]): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempFile = `${filePath}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(orders, null, 2), "utf8");
    await fs.rename(tempFile, filePath);
  }

  return createStateRepository({
    mutex: getFileMutex(filePath),
    load: async () => ({ ...emptyShopState(), orders: await readAll() }),
    persist: (state) => writeAll(state.orders),
  });
}

/** Lỗi ghi giả lập của `failNextCommit` — tách khỏi `ShopStateError` (lỗi dữ liệu). */
export class InjectedCommitError extends Error {
  constructor() {
    super("Lỗi ghi giả lập (failNextCommit)");
    this.name = "InjectedCommitError";
  }
}

export interface InMemoryRepositoryOptions {
  /** Tồn kho ban đầu; cũng dùng làm `inventoryBaseline`. */
  inventory?: Record<string, number>;
  /** Lần commit đầu tiên ném lỗi (chèn lỗi cho test, AD-6). */
  failNextCommit?: boolean;
}

/** Repository trong bộ nhớ - dùng cho unit test. */
export function createInMemoryOrderRepository(
  seed: Order[] = [],
  options: InMemoryRepositoryOptions = {},
): OrderRepository {
  // Clone từng trường riêng: structuredClone giữ tham chiếu dùng chung bên trong một giá trị,
  // nên clone chung một lần sẽ khiến inventory và inventoryBaseline trỏ cùng một object.
  let current: ShopState = {
    ...emptyShopState(),
    orders: structuredClone(seed),
    inventory: structuredClone(options.inventory ?? {}),
    inventoryBaseline: structuredClone(options.inventory ?? {}),
  };
  // Seed sai báo lỗi ngay khi dựng, không phải ở lần update đầu tiên.
  parseShopState(current, "Seed của repository in-memory");
  assertShopStateInvariants(current);
  let failNextCommit = options.failNextCommit ?? false;

  return createStateRepository({
    mutex: createMutex(),
    load: async () => current,
    async persist(state) {
      // Cùng kiểm tra schema như adapter file, để test in-memory không dễ dãi hơn production.
      parseShopState(state);
      if (failNextCommit) {
        failNextCommit = false;
        throw new InjectedCommitError();
      }
      current = structuredClone(state);
    },
  });
}
