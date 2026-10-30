# 运行与开发

## 环境与构建

需要 Node.js 22.13 或更新版本，以及随 Node.js 安装的 npm。支持 Windows、macOS 或 Linux；首次安装需要下载锁文件指定的依赖。请安装开发依赖和平台可选依赖，避免使用 `--omit=dev` 或 `--omit=optional`。

```sh
npm ci
npm run build
```

构建会生成 `dist/server/wrangler.json`。`.openai/hosting.json` 只声明逻辑绑定 `DB` 和 `BUCKET`，没有绑定作者的线上资源。依赖锁文件随源码提供。

## 首次初始化本地数据库

只在**新建且没有任何业务表的本地数据库**中，按以下顺序执行一次：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_simple_elektra.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_striped_fat_cobra.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_graceful_nocturne.sql
```

命令带有 `--local`，只操作本地模拟存储，不需要 Cloudflare 登录。已经初始化的数据库不要重复执行建表和加列语句；后续开发仅应用尚未执行的迁移。

迁移依次建立错题表、历史字段和分类表。历史答案与解析字段只保留数据库兼容性，应用接口不返回、编辑这些字段。

## 启动

```sh
npm run dev -- --hostname 127.0.0.1
```

打开 <http://127.0.0.1:5173/>。开发服务器只应在本机使用，登录流程采用本地模拟身份。数据保存在项目目录的 `.wrangler/state/`，停止并重新启动后会继续保留。这不是线上生产登录方式。

源码位于 `app/`、`components/notebook.tsx`、`lib/notebook-*.ts`。数据库结构在 `db/schema.ts`，已提交迁移位于 `drizzle/`。更新结构后可运行 `npm run db:generate` 生成新迁移，不要修改或重放已应用迁移。

## 编译检查

```sh
npm run typecheck
npm run build
```

`npm start` 使用 Wrangler 预览构建后的 Worker，但不会提供开发服务器的模拟登录，也不会配置生产身份网关。需要本机界面交互时使用 `npm run dev`，不要把模拟登录服务器作为公网服务部署。

## 数据与离线

图片与记录需要服务器、D1 和 R2。桌面入口不是本地离线数据库，离线时仅提供提示页，不缓存登录后的错题页面、接口或个人图片。清理 `.wrangler/state/` 会清除本地模拟数据；开源副本没有带入作者的数据。

手机相册、拍照、桌面安装及相机格式支持取决于浏览器和设备。请用真实手机对自己的 HTTPS 实例进行验证。
