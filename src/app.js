// app.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const productRoutes = require("./routes/products.routes");
const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/orders.routes"); // se você já usa para outras rotas
const webhookRoutes = require("./routes/webhooks.routes"); // seu webhook do MP
const createCheckout = require("./routes/orders.create-checkout"); // <-- NOVA ROTA

const app = express();

/** --------- Middlewares globais (ANTES das rotas) --------- */
app.use(cors({
  origin: [
    "https://vinicolaamana.vercel.app", // seu front
    // adicione outros domínios se precisar
  ],
  credentials: true,
}));

// MUITO IMPORTANTE: o JSON parser precisa vir ANTES das rotas (incluindo /webhooks)
app.use(express.json());

// Rate limiter básico
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "Muitas requisições, tente novamente em instantes.",
});
app.use(limiter);

/** ----------------- Rotas ----------------- */

// Rota de health simples
app.get("/", (req, res) => {
  res.send("Backend está rodando!");
});

// Webhooks (Mercado Pago + LGPD Nuvemshop)
app.use("/webhooks", webhookRoutes);

// Sua API
app.use("/api/products", productRoutes);
app.use("/auth", authRoutes);
app.use("/api/orders", orderRoutes); // mantém se já existir

// 👉 REGISTRA A ROTA QUE CRIA A PREFERÊNCIA DO MP
//    (usa metadata, back_urls e notification_url)
app.post("/api/orders/create-checkout", createCheckout);

/** --------------- Error handler --------------- */
const errorHandler = require("./middlewares/error.middleware");
app.use(errorHandler);

module.exports = app;
