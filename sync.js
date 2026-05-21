const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BASE_TOKEN = "Sudzb3xqza2Qnps1MGVcERUFnPh";
const OUTPUT_DIR = __dirname;

const TABLES = [
  { id: "tblP63xW1o6CwvpA", name: "主要指标", key: "main" },
  { id: "tblubcfi5BnghWwO", name: "流程清单", key: "processList" },
  { id: "tblg4VVq08HljsYo", name: "规范性清单", key: "normList" },
  { id: "tblVEqdlAYAb3TFy", name: "适用性清单", key: "applicabilityList" }
];

function fetchTable(tableId) {
  const result = execSync(
    `lark-cli base +record-list --base-token "${BASE_TOKEN}" --table-id "${tableId}" --as user --limit 500`,
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
  return parseTableOutput(result);
}

function parseTableOutput(output) {
  const lines = output.trim().split("\n");
  const records = [];
  let inTable = false;
  let headers = [];

  for (const line of lines) {
    if (line.startsWith("| _record_id |")) {
      inTable = true;
      headers = line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      continue;
    }
    if (line.startsWith("| --- |")) continue;
    if (!inTable) continue;
    if (!line.startsWith("|")) break;

    const cells = line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length >= headers.length) {
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ""; });
      delete row["_record_id"];
      records.push(row);
    }
  }
  return records;
}

function parseMainRecords(rawRecords) {
  return rawRecords.map(row => {
    const achievementRateStr = (row["达成率"] || "").trim();
    let achievementRate = null;
    if (achievementRateStr && achievementRateStr !== "NA") {
      const num = parseFloat(achievementRateStr);
      achievementRate = isNaN(num) ? null : num;
    }
    return {
      category: row["分类"] || "",
      monthlyAchievement: row["月度达成"] || "",
      monthlyTarget: row["月度目标"] || "",
      name: row["指标名称"] || "",
      remark: row["备注"] || "",
      formula: row["公式"] || "",
      total: row["总数"] || "",
      achievementRate
    };
  });
}

const data = {
  title: "XPD指标概览",
  source: "https://xiaopeng.feishu.cn/wiki/YVCSwf2mViezJwkXPN8c5LB7nVe",
  baseToken: BASE_TOKEN,
  updatedAt: new Date().toISOString(),
  tables: {}
};

for (const table of TABLES) {
  console.log(`Fetching ${table.name} (${table.id})...`);
  const raw = fetchTable(table.id);
  console.log(`  Got ${raw.length} records`);
  if (table.key === "main") {
    data.tables.main = { name: table.name, tableId: table.id, records: parseMainRecords(raw) };
    data.records = parseMainRecords(raw); // backward compatible
  } else {
    data.tables[table.key] = { name: table.name, tableId: table.id, records: raw };
  }
}

const outputFile = path.join(OUTPUT_DIR, "data.json");
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");
console.log(`\nSynced to ${outputFile}`);
console.log(`Main records: ${data.tables.main.records.length}`);
console.log(`ProcessList records: ${data.tables.processList.records.length}`);
