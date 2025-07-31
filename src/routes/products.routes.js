const express = require("express");
const router = express.Router();
const {
  listProducts,
  getProductById,
} = require("../controllers/products.controller");

router.get("/", listProducts);

router.get("/:id", getProductById);

module.exports = router;
