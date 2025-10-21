// app.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const productRoutes = require("./routes/products.routes");
const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/orders.routes"); // rota unificada de checkout
const errorHandler = require("./middlewares/error.middleware");
const webhookRoutes = require("./routes/webhooks.routes");

const app = express();

// (opcional, útil em proxy/CDN)
app.set("trust proxy", 1);

// 1) CORS sempre no topo
app.use(cors());

// 2) Rate limit GLOBAL (se quiser, pode EXCLUIR webhooks desse limite)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "Muitas requisições, tente novamente em instantes.",
});
app.use(limiter);

// 3) WEBHOOKS **ANTES** do express.json()
//    (webhooks.routes.js usa express.raw SOMENTE na rota de webhook)
app.use("/webhooks", webhookRoutes);

// 4) Parser JSON para o resto da API
app.use(express.json());

// 5) Suas rotas de negócio
app.use("/api/products", productRoutes);
app.use("/auth", authRoutes);
app.use("/api/orders", orderRoutes);

// 6) Healthcheck simples
app.get("/", (req, res) => {
  res.send("Backend está rodando!");
});

// 7) Handler de erros por último
app.use(errorHandler);

module.exports = app;
