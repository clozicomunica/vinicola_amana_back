const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const productRoutes = require("./routes/products.routes");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "Muitas requisições, tente novamente em instantes.",
});
app.use(limiter);

app.use("/api/products", productRoutes);

app.use(errorHandler);

app.get("/", (req, res) => {
  res.send("Backend está rodando!");
});

module.exports = app;
