const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");
require("dotenv").config();

// Configura Mercado Pago
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // deixe o token no .env
});

// Armazenamento temporário (substitua por MongoDB/Redis em produção)
const tempStorage = new Map();

// Endpoint para criar checkout com Mercado Pago Checkout Pro
router.post("/create-checkout", async (req, res) => {
  try {
    const { produtos, cliente, total } = req.body;

    // Validação básica
    if (!produtos?.length || !cliente?.name || !cliente?.email || !cliente?.document || !total) {
      return res.status(400).json({ error: "Dados incompletos (produtos, cliente ou total)" });
    }

    const preference = new Preference(mpClient);

    const response = await preference.create({
      body: {
        items: produtos.map(item => ({
          title: item.name,
          quantity: item.quantity,
          unit_price: Number(item.price),
          currency_id: "BRL",
        })),
        payer: {
          name: cliente.name,
          email: cliente.email,
          identification: { type: "CPF", number: cliente.document },
        },
        back_urls: {
          success: "https://vinicola-amana.com/success", // Troque pelo seu domínio real
          pending: "https://vinicola-amana.com/pending",
          failure: "https://vinicola-amana.com/failure",
        },
        auto_return: "approved",
        external_reference: `order_${Date.now()}`,
      },
    });

    const init_point = response.init_point; // URL para redirecionar o cliente

    // Armazena dados temporariamente para uso no webhook
    tempStorage.set(response.external_reference, { produtos, cliente, total });

    res.json({ redirect_url: init_point });
  } catch (error) {
    console.error("Erro ao criar checkout:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || "Erro ao criar checkout",
    });
  }
});

module.exports = router;
