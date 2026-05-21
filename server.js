#!/usr/bin/env node
/**
 * server.js - 数据看板本地服务器
 * 提供文件服务和数据同步功能
 * 用法: node server.js [端口]
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PORT = process.argv[2] || 3000;
const OUTPUT_DIR = __dirname;

const BASE_TOKEN = "Sudzb3xqza2Qnps1MGVcERUFnPh";

const TABLES = [
  { id: "tblP63xW1o6CwvpA", name: "主要指标", key: "main" },
  { id: "tblubcfi5BnghWwO", name: "流程清单", key: "processList" },
  { id: "tblg4VVq08HljsYo", name: "规范性清单", key: "normList" },
  { id: "tblVEqdlAYAb3TFy", name: "适用性清单", key: "applicabilityList" }
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  // CORS 支持
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 数据同步接口
  if (req.url === "/api/sync" && req.method === "POST") {
    syncData()
      .then(result => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      })
      .catch(error => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      });
    return;
  }

  // 布局保存接口
  if (req.url === "/api/save-layout" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const layoutFile = path.join(OUTPUT_DIR, "layout.json");
        fs.writeFileSync(layoutFile, body, "utf8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // 布局读取接口
  if (req.url === "/api/load-layout" && req.method === "GET") {
    const layoutFile = path.join(OUTPUT_DIR, "layout.json");
    fs.readFile(layoutFile, "utf8", (err, data) => {
      if (err) {
        if (err.code === "ENOENT") {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "布局文件不存在" }));
        } else {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    });
    return;
  }

  // 静态文件服务
  const cleanUrl = req.url.split("?")[0];
  let filePath = path.join(OUTPUT_DIR, cleanUrl === "/" ? "dashboard.html" : cleanUrl);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("文件不存在: " + req.url);
      } else {
        res.writeHead(500);
        res.end("服务器错误: " + err.message);
      }
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(data);
  });
});

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

function syncData() {
  return new Promise((resolve, reject) => {
    try {
      console.log("正在从飞书多维表格拉取数据...");
      const data = {
        title: "XPD指标概览",
        source: "https://xiaopeng.feishu.cn/wiki/YVCSwf2mViezJwkXPN8c5LB7nVe",
        baseToken: BASE_TOKEN,
        updatedAt: new Date().toISOString(),
        tables: {}
      };

      for (const table of TABLES) {
        console.log(`  拉取 ${table.name} (${table.id})...`);
        const raw = fetchTable(table.id);
        if (table.key === "main") {
          data.tables.main = { name: table.name, tableId: table.id, records: parseMainRecords(raw) };
          data.records = parseMainRecords(raw);
        } else {
          data.tables[table.key] = { name: table.name, tableId: table.id, records: raw };
        }
      }

      const outputFile = path.join(OUTPUT_DIR, "data.json");
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");
      console.log(`数据同步成功！主要指标: ${data.tables.main.records.length} 条，流程清单: ${data.tables.processList.records.length} 条`);
      resolve({ success: true, tables: Object.keys(data.tables).map(k => ({ name: data.tables[k].name, count: data.tables[k].records.length })), updatedAt: data.updatedAt });
    } catch (error) {
      reject(new Error(error.message));
    }
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`数据看板服务器已启动: http://0.0.0.0:${PORT}`);
  console.log(`按 Ctrl+C 停止服务器`);
});
