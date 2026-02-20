import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { connectRedis } from "./config/redis.js";

import tradeRoutes from "./routes/trade.routes.js";
import tokenRoutes from "./routes/token.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import historyRoutes from "./routes/history.routes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB();
connectRedis();

app.get("/api/health", (_, res) =>
  res.json({ status: "ok", network: "QIE", timestamp: Date.now() })
);

app.use("/api/trade", tradeRoutes);
app.use("/api/token", tokenRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/history", historyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 QIE-DEX Backend running on port ${PORT}`)
);
