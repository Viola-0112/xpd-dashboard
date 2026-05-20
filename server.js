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
const TABLE_ID = "tblP63xW1o6CwvpA";

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

function syncData() {
  return new Promise((resolve, reject) => {
    try {
      console.log("正在从飞书多维表格拉取数据...");
      const result = execSync(
        `lark-cli base +record-list --base-token "${BASE_TOKEN}" --table-id "${TABLE_ID}" --as user --limit 200`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      );

      const records = parseTableOutput(result);
      if (records.length === 0) {
        reject(new Error("未获取到任何数据"));
        return;
      }

      const data = {
        title: "XPD指标概览",
        source: "https://xiaopeng.feishu.cn/wiki/YVCSwf2mViezJwkXPN8c5LB7nVe",
        baseToken: BASE_TOKEN,
        tableId: TABLE_ID,
        updatedAt: new Date().toISOString(),
        records: records
      };

      const outputFile = path.join(OUTPUT_DIR, "data.json");
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");
      console.log(`数据同步成功！共 ${records.length} 条记录`);
      resolve({ success: true, count: records.length, updatedAt: data.updatedAt });
    } catch (error) {
      reject(new Error(error.message));
    }
  });
}

function parseTableOutput(output) {
  const lines = output.trim().split("\n");
  const records = [];

  let inTable = false;
  for (const line of lines) {
    if (line.startsWith("| _record_id |")) {
      inTable = true;
      continue;
    }
    if (line.startsWith("| --- |")) continue;
    if (!inTable) continue;
    if (!line.startsWith("|")) break;

    const cells = line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);

    if (cells.length >= 8) {
      const achievementRate = cells[7] ? parseFloat(cells[7]) : null;
      records.push({
        category: cells[1] || "",
        monthlyAchievement: cells[2] || "",
        monthlyTarget: cells[3] || "",
        name: cells[4] || "",
        formula: cells[5] || "",
        total: cells[6] || "",
        achievementRate: isNaN(achievementRate) ? null : achievementRate
      });
    }
  }

  return records;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`数据看板服务器已启动: http://0.0.0.0:${PORT}`);
  console.log(`按 Ctrl+C 停止服务器`);
});
