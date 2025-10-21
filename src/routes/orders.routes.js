// routes/orders.routes.js
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");
require("dotenv").config();

const MP_MODE = process.env.MP_MODE || "test"; // "test" | "prod"
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

if (!MP_ACCESS_TOKEN) {
  console.warn("[MP] Atenção: MP_ACCESS_TOKEN não definido no .env");
}

const mpClient = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN,
});

router.post("/create-checkout", async (req, res) => {
  try {
    const { produtos = [], cliente = {}, total } = req.body || {};

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return res.status(400).json({ error: "Lista de produtos vazia" });
    }
    if (total === undefined || total === null) {
      return res.status(400).json({ error: "Total não informado" });
    }

    const preference = new Preference(mpClient);

    const items = produtos.map((p) => ({
      title: String(p.name || "Produto"),
      quantity: Number(p.quantity || 1),
      unit_price: Number(p.price || 0),
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
          price: Number(p.price || 0),
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

    // Força link correto conforme o modo
    const redirect_url =
      MP_MODE === "test" ? pref.sandbox_init_point : pref.init_point;

    if (!redirect_url) {
      console.error("[MP] Preferência criada, mas sem init_point:", {
        MP_MODE,
        init_point: pref?.init_point,
        sandbox_init_point: pref?.sandbox_init_point,
        id: pref?.id,
      });
      return res
        .status(502)
        .json({ error: "MP não retornou URL de checkout (init_point)" });
    }

    // Log útil p/ debug
    console.log("[MP] Preferência criada", {
      mode: MP_MODE,
      preference_id: pref?.id,
      init_point: pref?.init_point,
      sandbox_init_point: pref?.sandbox_init_point,
    });

    return res.json({
      redirect_url,
      preference_id: pref.id,
      mode: MP_MODE,
    });
  } catch (error) {
    const payloadError = error?.response?.data || error;
    console.error("Erro MP create-checkout:", payloadError);
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.message ||
        "Erro ao criar checkout",
    });
  }
});

module.exports = router;
