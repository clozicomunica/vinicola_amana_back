// routes/orders.routes.js
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");
require("dotenv").config();

const MP_MODE = process.env.MP_MODE || "test"; // "test" | "prod"

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
});

router.post("/create-checkout", async (req, res) => {
  try {
    const { produtos = [], cliente = {}, total } = req.body || {};
    if (!produtos.length || !total) {
      return res.status(400).json({ error: "Dados incompletos (produtos/total)" });
    }

    const preference = new Preference(mpClient);

    const items = produtos.map((p) => ({
      title: p.name,
      quantity: Number(p.quantity || 1),
      unit_price: Number(p.price),
      currency_id: "BRL",
    }));

    const back_urls = {
      success: `${process.env.FRONT_URL || ""}/checkout/sucesso`,
      pending: `${process.env.FRONT_URL || ""}/checkout/pendente`,
      failure: `${process.env.FRONT_URL || ""}/checkout/erro`,
    };

    // Em TESTE não enviamos 'payer' para evitar conflito de partes
    const payer =
      MP_MODE === "prod"
        ? {
            name: cliente.name,
            email: cliente.email,
            identification: cliente.document
              ? { type: "CPF", number: cliente.document }
              : undefined,
          }
        : undefined;

    const body = {
      items,
      back_urls,
      auto_return: "approved",
      notification_url: `${process.env.BACK_URL || ""}/webhooks/order-paid`,
      external_reference: `order_${Date.now()}`,
      metadata: {
        produtos: produtos.map((p) => ({
          variant_id: p.variant_id || 0,
          quantity: Number(p.quantity || 1),
          price: Number(p.price),
          name: p.name || "",
        })),
        cliente: {
          name: cliente.name,
          email: cliente.email,
          document: cliente.document,
          address: cliente.address,
          city: cliente.city,
          state: cliente.state,
          zipcode: cliente.zipcode,
          complement: cliente.complement,
        },
        total: Number(total),
      },
      ...(payer ? { payer } : {}),
    };

    const pref = await preference.create({ body });
    const redirect = pref.init_point || pref.sandbox_init_point;
    if (!redirect) return res.status(500).json({ error: "MP não retornou init_point" });

    return res.json({
      redirect_url: redirect,
      preference_id: pref.id,
      mode: MP_MODE,
    });
  } catch (error) {
    console.error("Erro MP create-checkout:", error?.response?.data || error);
    return res
      .status(500)
      .json({ error: error?.response?.data?.message || error?.message || "Erro ao criar checkout" });
  }
});

module.exports = router;
