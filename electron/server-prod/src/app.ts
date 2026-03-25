import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/index.js";
import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(cors());
app.use(express.json());

// Request logger — shows every HTTP request that reaches Express
app.use((req, _res, next) => {
  logger.info(`[http] ${req.method} ${req.url}`);
  next();
});

app.use("/api", apiRouter);

// 生产模式：托管前端静态文件（Electron 打包后 client/dist 放在 resources/client/dist）
if (process.env.NODE_ENV === "production") {
  // Electron 环境：资源在 process.resourcesPath/client/dist
  // 普通生产环境：相对路径 ../../client/dist
  const clientDist = process.env.ELECTRON_RESOURCES_PATH
    ? path.join(process.env.ELECTRON_RESOURCES_PATH, "client", "dist")
    : path.join(__dirname, "..", "..", "client", "dist");

  app.use(express.static(clientDist));
  app.get("/*path", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

export default app;
