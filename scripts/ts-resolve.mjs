// Cho phép `node --import ./scripts/ts-resolve.mjs` chạy TypeScript của src/ bằng Node có sẵn
// (strip types), không cần thêm dependency: map alias `@/` và import không đuôi sang file `.ts`.
import { register } from "node:module";

register("./ts-resolve-hooks.mjs", import.meta.url);
