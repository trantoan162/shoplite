// npm run stock:set -- p004=10 p010=150
// Đặt lại tồn kho (AD-16). Chạy khi server đã dừng; xem README.
import { formatStockChange, runStockSet } from "../src/features/orders/stock-set";

try {
  const result = await runStockSet({ args: process.argv.slice(2) });
  if (result.ok) {
    for (const change of result.changes) console.log(formatStockChange(change));
  } else {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
  }
} catch (error) {
  // Lỗi I/O bất ngờ (quyền, ổ đĩa…): một dòng dễ đọc thay vì stack trace.
  console.error(`stock:set thất bại: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
