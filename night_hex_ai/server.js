
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import chatHandler from "./api/chat.js";
import adminHandler from "./api/admin.js";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "32kb" }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "NIGHT HEX AI is running" });
});

// API routes
app.all("/api/chat", (req, res) => {
  return chatHandler(req, res);
});

app.all("/api/admin", (req, res) => {
  return adminHandler(req, res);
});

// Frontend files
const frontendFiles = [
  "/style.css",
  "/app.js",
  "/admin.html",
  "/admin.js"
];

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get(frontendFiles, (req, res) => {
  const filename = path.basename(req.path);
  res.sendFile(path.join(__dirname, filename));
});

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Page not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NIGHT HEX AI running on port ${PORT}`);
});
