# XPD 指标看板 - 内网部署说明

## 文件清单

| 文件 | 说明 |
|------|------|
| `dashboard.html` | 看板前端页面 |
| `data.json` | 指标数据源 |
| `layout.json` | 布局配置文件 |
| `server.js` | Node.js 本地服务器 |

## 部署步骤

### 1. 环境要求
- Node.js 14+（运行 `node -v` 检查版本）

### 2. 启动服务器

在服务器上进入本文件夹，执行：

```bash
node server.js 3000
```

默认端口为 3000，也可指定其他端口：

```bash
node server.js 8080
```

### 3. 访问看板

启动成功后，同事通过以下地址访问：

```
http://<服务器内网IP>:3000
```

例如：`http://192.168.1.100:3000`

## 更新机制

### 更新数据（data.json）

看板数据从飞书多维表格同步。更新方式：

1. 在本地环境运行 `lark-cli` 拉取最新数据
2. 将更新后的 `data.json` 覆盖到服务器上的同名文件
3. 刷新浏览器即可看到最新数据

### 更新布局（layout.json）

1. 在看板页面调整布局后，点击「保存布局」
2. 如果是在服务器上直接操作，布局会自动保存到服务器的 `layout.json`
3. 如果是在本地调整后需要同步到服务器，将本地 `layout.json` 覆盖到服务器即可

## 后台常驻运行（可选）

使用 pm2 保持服务常驻：

```bash
npm install -g pm2
pm2 start server.js --name "xpd-dashboard"
pm2 save
```

## 注意事项

- server.js 已绑定 `0.0.0.0`，局域网内均可访问
- 建议配置服务器防火墙，仅开放内网访问
- data.json 和 layout.json 是运行时关键文件，请勿删除
