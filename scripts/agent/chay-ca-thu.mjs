#!/usr/bin/env node
// Chạy và chấm năm ca thử của một agent. Máy chấm, không cần AI.
//   node scripts/agent/chay-ca-thu.mjs <tên>             chạy thật cả năm ca (tốn tiền)
//   node scripts/agent/chay-ca-thu.mjs <tên> --chi ca-3  chạy thật một ca, các ca khác chấm lại
//   node scripts/agent/chay-ca-thu.mjs <tên> --cham-lai  chấm lại kết quả đã lưu, không gọi AI
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const SO_CA = 5;
const CA_DAT = 4;

const ten = process.argv[2];
const chamLai = process.argv.includes("--cham-lai");
const chi = process.argv.includes("--chi") ? process.argv[process.argv.indexOf("--chi") + 1] : null;
if (!/^[a-z0-9-]+$/.test(ten ?? "")) {
  console.error("Cần tên agent, ví dụ: node scripts/agent/chay-ca-thu.mjs release-notes");
  process.exit(2);
}

const goc = `.claude/evals/${ten}`;
if (!existsSync(`${goc}/cau-hinh.json`)) {
  console.error(`Không thấy ${goc}/cau-hinh.json`);
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(`${goc}/cau-hinh.json`, "utf8"));
const vt = tinhVanTay();
mkdirSync(`${goc}/ket-qua`, { recursive: true });

const dsCa = readdirSync(goc)
  .filter((d) => /^ca-\d+$/.test(d))
  .sort();
let dat = 0;
let tien = 0;

for (const d of dsCa) {
  const ca = JSON.parse(readFileSync(`${goc}/${d}/ca.json`, "utf8"));
  const dien = (s) => s.replaceAll("{ca}", `${goc}/${d}`).replaceAll("{kq}", `${goc}/ket-qua`);
  const fKq = `${goc}/ket-qua/${d}.json`;
  const tepKiem = ca.kiem.tep ? dien(ca.kiem.tep.duong_dan) : null;

  let kq = null;
  if (chamLai || (chi && chi !== d)) {
    if (existsSync(fKq)) kq = JSON.parse(readFileSync(fKq, "utf8"));
  } else {
    if (tepKiem) rmSync(tepKiem, { force: true });
    kq = chay(ca, d, dien);
    writeFileSync(fKq, JSON.stringify(kq, null, 2) + "\n");
  }

  const loi = kq ? cham(ca.kiem, kq, tepKiem) : ["chưa có kết quả: chạy thật một lần trước"];
  tien += kq?.total_cost_usd ?? 0;
  if (!loi.length) dat++;
  const giay = ((kq?.duration_ms ?? 0) / 1000).toFixed(0);
  console.log(
    `${loi.length ? "ĐỎ " : "ĐẠT"} ${d} ${ca.ten} · ${kq?.num_turns ?? 0} lượt · ` +
      `$${(kq?.total_cost_usd ?? 0).toFixed(3)} · ${giay}s · từ chối ${kq?.permission_denials?.length ?? 0}` +
      (loi.length ? `\n     ${loi.join("; ")}` : ""),
  );
}

console.log(`\n${dat}/${dsCa.length} ca đạt · tổng $${tien.toFixed(3)} · vân tay ${vt}`);
if (dsCa.length < SO_CA) console.log(`Mới có ${dsCa.length} ca, cần đủ ${SO_CA} ca.`);
process.exit(dsCa.length >= SO_CA && dat >= CA_DAT ? 0 : 1);

// Vân tay: thứ làm agent đổi cách chạy. Sửa một chữ trong đây thì kết quả cũ thành CŨ.
// Không gồm ca.json: sửa phép kiểm thì chấm lại được, không cần tốn tiền chạy lại.
function tinhVanTay() {
  const co = cfg.co ?? [];
  const mcp = co.includes("--mcp-config") ? [co[co.indexOf("--mcp-config") + 1]] : [];
  const tep = [
    ...liet(`.claude/skills/${ten}`),
    `.claude/agents/${ten}.md`,
    ".claude/settings.json",
    ".mcp.json",
    `${goc}/cau-hinh.json`,
    ...mcp,
    ...(cfg.van_tay_them ?? []),
  ];
  const bam = createHash("sha256");
  for (const f of tep)
    if (existsSync(f)) {
      bam.update(f);
      // Git trên Windows có thể đổi xuống dòng thành CRLF: không tính là sửa.
      bam.update(readFileSync(f, "utf8").replaceAll("\r\n", "\n"));
    }
  return bam.digest("hex").slice(0, 12);
}

function liet(thuMuc) {
  if (!existsSync(thuMuc)) return [];
  return readdirSync(thuMuc)
    .sort()
    .flatMap((f) => {
      const p = path.posix.join(thuMuc, f);
      return statSync(p).isDirectory() ? liet(p) : [p];
    });
}

function chay(ca, d, dien) {
  const dauVao = `${goc}/${d}/dau-vao.json`;
  const env = { ...process.env };
  if (existsSync(dauVao)) env.CA_THU_DAU_VAO = dauVao;
  for (const [k, v] of Object.entries(ca.moi_truong ?? {})) env[k] = dien(v);
  const r = spawnSync("claude", ["-p", ca.loi_goi, ...cfg.co], {
    encoding: "utf8",
    input: "",
    env,
    timeout: 5 * 60 * 1000,
    maxBuffer: 50 * 1024 * 1024,
  });
  try {
    return { ...JSON.parse(r.stdout), van_tay: vt };
  } catch {
    const lyDo = r.error?.message ?? r.stderr?.trim().split("\n")[0] ?? "không rõ";
    return { result: "", loi_chay: lyDo, van_tay: vt };
  }
}

function cham(k, kq, tepKiem) {
  const t = kq.result ?? "";
  const loi = [];
  if (kq.loi_chay) loi.push(`không chạy được: ${kq.loi_chay}`);
  if (kq.is_error || (kq.subtype && kq.subtype !== "success"))
    loi.push(`agent dừng giữa chừng: ${kq.subtype ?? "lỗi"}`);
  for (const s of k.co ?? []) if (!t.includes(s)) loi.push(`thiếu "${s}"`);
  for (const s of k.khong_co ?? []) if (t.includes(s)) loi.push(`không được có "${s}"`);
  for (const r of k.khop ?? []) if (!new RegExp(r, "m").test(t)) loi.push(`không khớp /${r}/`);
  for (const r of k.khong_khop ?? [])
    if (new RegExp(r, "m").test(t)) loi.push(`không được khớp /${r}/`);
  for (const n of k.moi_pr ?? []) {
    const lan = (t.match(new RegExp(`\\(#${n}\\)`, "g")) ?? []).length;
    if (lan !== 1) loi.push(`PR #${n} xuất hiện ${lan} lần`);
  }
  if (k.thu_tu) {
    const v = k.thu_tu.map((s) => t.indexOf(s));
    if (v.includes(-1) || v.some((x, i) => i && x < v[i - 1]))
      loi.push(`sai thứ tự ${k.thu_tu.join(" > ")}`);
  }
  if (k.tep) {
    const co = existsSync(tepKiem);
    if (k.tep.khong_ton_tai && co) loi.push(`không được có file ${tepKiem}`);
    if (!k.tep.khong_ton_tai && !co) loi.push(`thiếu file ${tepKiem}`);
    const noiDung = co ? readFileSync(tepKiem, "utf8") : "";
    for (const r of k.tep.khop ?? [])
      if (!new RegExp(r, "m").test(noiDung)) loi.push(`file không khớp /${r}/`);
    for (const r of k.tep.khong_khop ?? [])
      if (new RegExp(r, "m").test(noiDung)) loi.push(`file không được khớp /${r}/`);
  }
  if (kq.van_tay !== vt) loi.push("CŨ: chạy trước lần sửa cuối");
  return loi;
}
