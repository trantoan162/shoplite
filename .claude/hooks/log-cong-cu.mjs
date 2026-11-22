#!/usr/bin/env node
// Hook: PostToolUse (matcher: *)
// Ghi MỌI lời gọi công cụ vào .claude/logs/cong-cu.jsonl, che số điện thoại, email, khoá API trước khi ghi.
// Khác log-bash.mjs của Module 1: hook đó ghi nguyên văn để học cấu trúc payload, không dùng được khi
// agent đọc dữ liệu khách.
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

let data = "";
for await (const chunk of process.stdin) data += chunk;
const input = JSON.parse(data || "{}");

const che = (s) =>
  s
    .replace(/(?:\+84|0)[35789](?:[ .-]?\d){8}/g, "[đã che]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[đã che]")
    .replace(/sk-ant-[\w-]+/g, "[đã che]");

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
const logDir = path.join(projectDir, ".claude", "logs");
mkdirSync(logDir, { recursive: true });
appendFileSync(
  path.join(logDir, "cong-cu.jsonl"),
  che(
    JSON.stringify({
      luc: new Date().toISOString(),
      cong_cu: input.tool_name,
      dau_vao: input.tool_input,
    }),
  ) + "\n",
);
process.exit(0);
