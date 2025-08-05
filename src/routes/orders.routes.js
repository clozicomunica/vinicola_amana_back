const express = require("express");
const router = express.Router();
const fetch = require("node-fetch"); // npm install node-fetch
require("dotenv").config(); // npm install dotenv

router.post("/checkout", async (req, res) => {
  try {
    const orderData = req.body;

    // Requisição para a API da Nuvemshop
    const response = await fetch(
      "https://api.tiendanube.com/v1/6359166/orders",
      {
        method: "POST",
        headers: {
          Authentication: `Bearer ${process.env.TOKEN}`, // Usa variável de ambiente
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao criar pedido na Nuvemshop");
    }

    const data = await response.json();

    // Tentar obter o checkout_url via endpoint /checkout
    if (!data.checkout_url && data.id) {
      const checkoutResponse = await fetch(
        `https://api.tiendanube.com/v1/6359166/orders/${data.id}/checkout`,
        {
          method: "GET",
          headers: {
            Authentication: `bearer ${ACCESS_TOKEN}`, // Mesmo token
            "Content-Type": "application/json",
          },
        }
      );

      if (checkoutResponse.ok) {
        const checkoutData = await checkoutResponse.json();
        if (checkoutData.redirect_url) {
          data.checkout_url = checkoutData.redirect_url;
        }
      }
    }

    // Fallback se checkout_url não estiver disponível
    if (!data.checkout_url && data.id) {
      data.checkout_url = `${process.env.STORE_DOMAIN}/checkout/${data.id}`; // Usa variável de ambiente
    }

    res.json(data);
  } catch (error) {
    console.error("Erro no checkout:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
