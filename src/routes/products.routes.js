const express = require("express");
const router = express.Router();

const {
  listProducts,
  getProductById,
  getSimilarProducts,
  checkoutOrder,
} = require("../controllers/products.controller");

router.get("/", listProducts);
router.get("/:id", getProductById);
router.get("/:id/similares", getSimilarProducts);

// 🛠️ Remova esta linha
// router.post("/checkout", checkoutOrder);

module.exports = router;
