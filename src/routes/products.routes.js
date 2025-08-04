const express = require("express");
const router = express.Router();

const {
  listProducts,
  getProductById,
  getSimilarProducts,
  checkoutOrder, // ✅ mesmo nome exportado
} = require("../controllers/products.controller");

router.get("/", listProducts);
router.get("/:id", getProductById);
router.get("/:id/similares", getSimilarProducts);
router.post("/products/checkout", checkoutOrder); // ✅ caminho corrigido

module.exports = router;
