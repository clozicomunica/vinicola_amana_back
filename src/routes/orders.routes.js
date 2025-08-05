const express = require("express");
const router = express.Router();
const { api } = require("../services/nuvemshop.service");
require("dotenv").config();

router.post("/checkout", async (req, res) => {
  try {
    const orderData = req.body;

    // Enviar pedido para Nuvemshop
    const response = await api.post("/orders", orderData, {
      headers: {
        Authentication: `bearer ${process.env.NUVEMSHOP_ACCESS_TOKEN}`, // Correto
        "User-Agent": "Vinicola (amana.lojaonline@gmail.com)",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const data = response.data;

    // Se não tiver checkout_url, tenta obter via /orders/:id/checkout
    if (!data.checkout_url && data.id) {
      try {
        const checkoutResponse = await api.get(`/orders/${data.id}`, {
          headers: {
            Authentication: `bearer ${process.env.NUVEMSHOP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        });
        if (checkoutResponse.data?.redirect_url) {
          data.checkout_url = checkoutResponse.data.redirect_url;
        }
      } catch (err) {
        console.warn("Erro ao buscar checkout_url:", err.message);
      }
    }

    // Fallback manual
    if (!data.checkout_url && data.id) {
      data.checkout_url = `${process.env.STORE_DOMAIN}/checkout/${data.id}`;
    }

    res.json(data);
  } catch (error) {
    console.error("Erro no checkout:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data || "Erro ao processar o checkout",
    });
  }
});

module.exports = router;
