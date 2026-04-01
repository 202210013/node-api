const express = require("express");
const cors = require("cors");
const apiRouter = require("./routes/apiRouter");

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "localfit-node-api" });
});

app.use("/", apiRouter);

app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    details: process.env.NODE_ENV === "production" ? undefined : err.message
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

module.exports = app;
