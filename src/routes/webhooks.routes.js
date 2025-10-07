// routes/webhooks.routes.js (patch)
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");
const axios = require("../axiosClient"); // <- caminho corrigido
const crypto = require("crypto");

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const APP_SECRET = process.env.NUVEMSHOP_CLIENT_SECRET;

// GET ping
router.get("/order-paid", (req, res) => res.status(200).send("OK"));

// POST payment (usar JSON só aqui)
router.post("/order-paid", express.json(), async (req, res) => {
  // ACK o mais rápido possível
  res.status(200).json({ status: "received" });

  try {
    // Suportar body e/ou query
    const type = req.body?.type || req.query?.type;
    const dataId = req.body?.data?.id || req.query?.["data.id"];

    if (type !== "payment" || !dataId) return;

    const paymentClient = new Payment(mpClient);
    const payment = await paymentClient.get({ id: dataId });

    if (payment.status !== "approved") return;

    const external_reference = payment.external_reference;
    const meta = payment.metadata || {};
    const produtos = meta.produtos;
    const cliente = meta.cliente;
    const total = meta.total;

    if (!produtos || !cliente || !total) {
      console.error("Metadados ausentes, external_reference:", external_reference);
      return;
    }

    // Idempotência simples (ex.: checar se já criamos ordem por payment.id)
    // Exemplo de chamada a um endpoint seu/DB antes de criar na Nuvemshop:
    // const already = await Orders.findOne({ paymentId: String(payment.id) });
    // if (already) return;

    const payload = {
      gateway: "offline",
      payment_status: "paid",
      paid_at: new Date().toISOString().replace("Z", "-03:00"),
      products: produtos.map(item => ({
        variant_id: item.variant_id || 0,
        quantity: item.quantity,
        price: Number(item.price),
      })),
      customer: {
        name: cliente.name,
        email: cliente.email,
        identification: { type: "CPF", number: cliente.document },
      },
      billing_address: {
        address: cliente.address,
        city: cliente.city,
        province: "SP",
        country: "BR",
        zipcode: cliente.zipcode,
      },
      shipping_address: {
        address: cliente.address,
        city: cliente.city,
        province: "SP",
        country: "BR",
        zipcode: cliente.zipcode,
      },
      shipping_pickup_type: "ship",
      shipping: "Correios",
      shipping_option: "PAC",
      shipping_cost_customer: 10.0,
      total: Number(total),
      owner_note: `Baixa via Mercado Pago - Payment ID: ${payment.id}, Ref: ${external_reference}`,
    };

    await axios.post("/orders", payload);
    console.log("✅ Ordem criada via webhook MP:", payment.id);
  } catch (error) {
    console.error("Webhook MP error:", error?.response?.data || error.message || error);
  }
});

/** LGPD endpoints — precisam do RAW body */
function verifyWebhook(rawBody, hmacHeader) {
  if (!hmacHeader) return false;
  const calculatedHmac = crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("base64");
  return hmacHeader === calculatedHmac;
}

router.post("/store-redact", express.raw({ type: "application/json" }), (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader = req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];
  if (!verifyWebhook(rawBody, hmacHeader)) return res.status(401).send("Assinatura inválida");
  const { store_id } = JSON.parse(rawBody);
  console.log(`LGPD store-redact loja ${store_id}`);
  res.status(200).send("OK");
});

router.post("/customers-redact", express.raw({ type: "application/json" }), (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader = req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];
  if (!verifyWebhook(rawBody, hmacHeader)) return res.status(401).send("Assinatura inválida");
  const { store_id, customer, orders_to_redact } = JSON.parse(rawBody);
  console.log(`LGPD customers-redact ${customer?.id} loja ${store_id} pedidos: ${orders_to_redact}`);
  res.status(200).send("OK");
});

router.post("/customers-data-request", express.raw({ type: "application/json" }), (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader = req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];
  if (!verifyWebhook(rawBody, hmacHeader)) return res.status(401).send("Assinatura inválida");
  const { store_id, customer } = JSON.parse(rawBody);
  console.log(`LGPD data-request cliente ${customer?.id} loja ${store_id}`);
  res.status(200).send("OK");
});

module.exports = router;
