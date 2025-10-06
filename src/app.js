// app.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const productRoutes = require("./routes/products.routes");
const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/orders.routes"); // suas rotas já existentes
const webhookRoutes = require("./routes/webhooks.routes"); // MP + LGPD
const createCheckout = require("./routes/orders.create-checkout"); // cria preferência MP
const errorHandler = require("./middlewares/error.middleware");

const app = express();

/** 1) CORS vem PRIMEIRO (inclui preflight) */
app.use(cors({
  origin: [
    "https://vinicolaamana.vercel.app", // seu front em produção
    "http://localhost:5173",            // dev local (se usar)
  ],
  credentials: true,
}));

/** Responder preflight globalmente (antes de tudo) */
app.options("*", cors());

/** 2) Parser JSON ANTES das rotas */
app.use(express.json());

/** 3) Rate limit — NÃO bloquear OPTIONS (preflight) */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas requisições, tente novamente em instantes.",
  skip: (req) => req.method === "OPTIONS", // <— ESSENCIAL
});
app.use(limiter);

/** Healthcheck simples */
app.get("/", (req, res) => res.send("Backend está rodando!"));

/** 4) Webhooks (Mercado Pago + LGPD Nuvemshop) */
app.use("/webhooks", webhookRoutes);

/** 5) API existente */
app.use("/api/products", productRoutes);
app.use("/auth", authRoutes);
app.use("/api/orders", orderRoutes);

/** 6) Endpoint que o front chama para criar a preferência do MP */
app.post("/api/orders/create-checkout", createCheckout);

/** 7) Error handler DEPOIS das rotas */
app.use(errorHandler);

module.exports = app;
