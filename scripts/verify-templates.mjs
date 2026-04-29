// Quick sanity check that each generated template round-trips through ExcelJS
// and carries a valid _strategy_model JSON payload.
import ExcelJS from "exceljs";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "public", "templates");

let failed = 0;
for (const f of readdirSync(dir).filter((n) => n.endsWith(".xlsx"))) {
  const buf = readFileSync(join(dir, f));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const ws = wb.getWorksheet("_strategy_model");
  const cell = ws?.getCell(1, 1).value;
  const text = typeof cell === "string" ? cell : cell?.text ?? "";
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      throw new Error("missing nodes/edges arrays");
    }
    console.log(
      `ok ${f} — ${parsed.nodes.length} nodes, ${parsed.edges.length} edges, v${parsed.v}`
    );
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${f}: ${e.message}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
