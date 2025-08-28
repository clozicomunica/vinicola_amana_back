const express = require("express");
const router = express.Router();
const api = require("../utils/axiosClient"); // Ajuste se o path for diferente; use o cliente Axios existente
require("dotenv").config();

router.post("/checkout", async (req, res) => {
  try {
    const orderData = req.body;

    // Garanta que o gateway esteja setado (ex.: mercadopago)
    if (!orderData.gateway) {
      return res.status(400).json({ error: "Gateway de pagamento é obrigatório (ex.: mercadopago)" });
    }

    // Enviar pedido para Nuvemshop
    const response = await api.post("/orders", orderData);

    let data = response.data;

    // Tente obter checkout_url via GET /orders/:id (buscando campos como checkout_url ou gateway_link)
    if (!data.checkout_url && data.id) {
      try {
        const orderDetails = await api.get(`/orders/${data.id}`);
        const details = orderDetails.data;
        if (details.checkout_url) {
          data.checkout_url = details.checkout_url;
        } else if (details.gateway_link) {
          data.checkout_url = details.gateway_link; // Algumas gateways fornecem isso
        } else if (details.redirect_url) {
          data.checkout_url = details.redirect_url;
        }
      } catch (err) {
        console.warn("Erro ao buscar detalhes da ordem para checkout_url:", err.message);
      }
    }

    // Fallback manual para URL de checkout da Nuvemshop
    if (!data.checkout_url && data.id) {
      data.checkout_url = `${process.env.STORE_DOMAIN}/checkout/${data.id}`;
    }

    // Se ainda não tiver URL, erro
    if (!data.checkout_url) {
      throw new Error("Não foi possível gerar URL de checkout");
    }

    res.json(data);
  } catch (error) {
    console.error("Erro no checkout:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || "Erro ao processar o checkout",
    });
  }
});

module.exports = router;