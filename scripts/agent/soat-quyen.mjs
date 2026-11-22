#!/usr/bin/env node
// So mọi luật cho phép với mục 6 của bản thiết kế: node scripts/agent/soat-quyen.mjs <tên>
// Luật nào rộng hơn mục 6 là lỗi, trừ khi đã bị --disallowedTools chặn lại.
import { existsSync, readFileSync } from "node:fs";

const SO_MUC = 11;
const ten = process.argv[2];
if (!/^[a-z0-9-]+$/.test(ten ?? "")) {
  console.error("Cần tên agent, ví dụ: node scripts/agent/soat-quyen.mjs release-notes");
  process.exit(2);
}
const goc = `.claude/evals/${ten}`;
for (const f of [`${goc}/agent_design.md`, `${goc}/cau-hinh.json`])
  if (!existsSync(f)) {
    console.error(`Không thấy ${f}`);
    process.exit(2);
  }

const thietKe = readFileSync(`${goc}/agent_design.md`, "utf8");
const muc6 = (thietKe.match(/```cong-cu\n([\s\S]*?)```/)?.[1] ?? "")
  .split("\n")
  .map((dong) => dong.trim())
  .filter(Boolean)
  .map((dong) => {
    const i = dong.indexOf(":");
    return [dong.slice(0, i), dong.slice(i + 1).trim()];
  });
const theoLoai = (loai) => muc6.filter(([k]) => k === loai).map(([, v]) => v);
const lenh = theoLoai("lenh");
const doc = theoLoai("doc");
const ghi = theoLoai("ghi");
const web = theoLoai("web");
const mcp = theoLoai("mcp").map((v) => `mcp__${v.replace("/", "__")}`);

const co = JSON.parse(readFileSync(`${goc}/cau-hinh.json`, "utf8")).co;
const giaTri = (cờ) => {
  const i = co.indexOf(cờ);
  if (i < 0) return [];
  const ds = [];
  for (let j = i + 1; j < co.length && !co[j].startsWith("--"); j++) ds.push(co[j]);
  return ds;
};

const tools = giaTri("--tools")[0];
const dsTools = tools ? tools.split(",").map((s) => s.trim()) : [];
const bashBat = !tools || dsTools.includes("Bash");

const pathGon = (p) => p.replace(/^\.?\//, "");
const trongMuc6 = (luat) => {
  if (luat.startsWith("Bash(")) return lenh.includes(luat.slice(5, -1).replace(/ \*$/, ""));
  if (luat.startsWith("mcp__")) return mcp.includes(luat);
  if (luat.startsWith("Read(")) return doc.includes(pathGon(luat.slice(5, -1)));
  if (/^(Edit|Write)\(/.test(luat))
    return ghi.includes(pathGon(luat.slice(luat.indexOf("(") + 1, -1)));
  if (luat.startsWith("WebFetch(domain:")) return web.includes(luat.slice(16, -1));
  return false;
};

// Công cụ bật cả loại (--tools, tools: của subagent) phải có dòng tương ứng ở mục 6.
const congCuCoMuc6 = (cc) => {
  if (cc.startsWith("mcp__")) return mcp.includes(cc);
  if (cc === "Bash") return lenh.length > 0;
  if (cc === "Read") return doc.length > 0;
  if (cc === "Edit" || cc === "Write") return ghi.length > 0;
  if (cc === "WebFetch") return web.length > 0;
  return false;
};

const tuChoi = giaTri("--disallowedTools");
const biChan = (luat) =>
  luat.startsWith("Bash(") &&
  tuChoi.some(
    (d) => d.startsWith("Bash(") && luat.slice(5).startsWith(d.slice(5).replace(/\*?\)$/, "")),
  );
// Ba luật git của Module 1 là lệnh chỉ đọc, Claude Code vốn cho chạy không cần luật.
const chiDoc = (luat) => /^Bash\(git (status|diff|log)\b/.test(luat);

const fileSkill = `.claude/skills/${ten}/SKILL.md`;
const fileAgent = `.claude/agents/${ten}.md`;
const frontmatter = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const luatSkill =
  frontmatter(fileSkill)
    .match(/^allowed-tools:\s*(.*)$/m)?.[1]
    .match(/[A-Za-z_][\w-]*(\([^)]*\))?/g) ?? [];
const toolsAgent =
  frontmatter(fileAgent)
    .match(/^tools:\s*(.*)$/m)?.[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const luatDuAn = existsSync(".claude/settings.json")
  ? (JSON.parse(readFileSync(".claude/settings.json", "utf8")).permissions?.allow ?? [])
  : [];

const loi = [];

for (let n = 1; n <= SO_MUC; n++)
  if (!new RegExp(`^## ${n}\\.`, "m").test(thietKe)) loi.push(`agent_design.md thiếu mục ${n}`);
if (!muc6.length) loi.push("Mục 6 trống: chưa có khối cong-cu");
if (!existsSync(fileSkill) && !existsSync(fileAgent))
  loi.push(`Chưa có ${fileSkill} hoặc ${fileAgent}`);

for (const [nguon, ds] of [
  ["--allowedTools", giaTri("--allowedTools")],
  ["allowed-tools của skill", luatSkill],
  [".claude/settings.json", luatDuAn],
])
  for (const luat of ds) {
    if (trongMuc6(luat) || biChan(luat) || chiDoc(luat)) continue;
    if (nguon === ".claude/settings.json" && luat.startsWith("Bash(") && !bashBat) continue;
    loi.push(`${nguon}: ${luat} nằm ngoài mục 6`);
  }

for (const cc of toolsAgent)
  if (!congCuCoMuc6(cc)) loi.push(`tools: của subagent: ${cc} nằm ngoài mục 6`);

const cheDo = giaTri("--permission-mode")[0];
if (cheDo !== "dontAsk")
  loi.push(`--permission-mode là ${cheDo ?? "(không đặt)"}, phải là dontAsk`);
if (!tools) loi.push("Thiếu --tools: mọi công cụ dựng sẵn đều bật");
else
  for (const cc of dsTools)
    if (!congCuCoMuc6(cc))
      loi.push(
        cc === "Bash" ? "Mục 6 không có lenh: mà Bash vẫn bật" : `--tools: ${cc} nằm ngoài mục 6`,
      );
if (!co.includes("--strict-mcp-config")) loi.push("Thiếu --strict-mcp-config");
if (!co.includes("--max-turns")) loi.push("Thiếu --max-turns");
if (!co.includes("--max-budget-usd")) loi.push("Thiếu --max-budget-usd");

for (const dong of loi) console.log(`LỖI  ${dong}`);
console.log(`${loi.length} lỗi`);
process.exit(loi.length ? 1 : 0);
