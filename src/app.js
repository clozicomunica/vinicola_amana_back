// app.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const productRoutes = require("./routes/products.routes");
const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/orders.routes"); 
const webhookRoutes = require("./routes/webhooks.routes"); 
const errorHandler = require("./middlewares/error.middleware");

const app = express();

const corsOptions = {
  origin: [
    "https://vinicolaamana.vercel.app",
    "http://localhost:5173",
  ],
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));


app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas requisições, tente novamente em instantes.",
  skip: (req) => req.method === "OPTIONS", // <— ESSENCIAL
});
app.use(limiter);


app.get("/", (req, res) => res.send("Backend está rodando!"));


app.use("/webhooks", webhookRoutes);

app.use("/api/products", productRoutes);
app.use("/auth", authRoutes);
app.use("/api/orders", orderRoutes);



app.use(errorHandler);

module.exports = app;
