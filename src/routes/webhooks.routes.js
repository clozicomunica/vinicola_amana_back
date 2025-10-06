const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");
const axios = require("../utils/axiosClient"); // seu client p/ Nuvemshop
require("dotenv").config();
const crypto = require("crypto");

/** ======== CONFIG ======== */
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // APP_USR-... (produção)
});

const APP_SECRET = process.env.NUVEMSHOP_CLIENT_SECRET;

/**
 * ✅ DICA: garanta no app principal:
 * app.use(express.json());
 * app.use("/webhooks", require("./routes/webhooks.routes"));
 */

/* ------------------------------ HEALTH/PING ------------------------------ */
// Mercado Pago às vezes acessa GET para verificar se a rota responde.
router.get("/order-paid", (req, res) => {
  return res.status(200).send("OK");
});

/* ------------------------------ MP: PAGAMENTO APROVADO ------------------------------ */
router.post("/order-paid", async (req, res) => {
  // Ex: { "type": "payment", "data": { "id": 123456789 } }
  const { type, data } = req.body || {};

  if (type !== "payment" || !data?.id) {
    // Não é evento de pagamento → ignora
    return res.status(200).json({ status: "ignored" });
  }

  try {
    const paymentClient = new Payment(mpClient);
    const payment = await paymentClient.get({ id: data.id });

    // Log mínimo para correlação
    console.log("[MP Webhook] payment_id:", payment.id, "status:", payment.status);

    if (payment.status !== "approved") {
      // Não aprovado ainda → responde 200 para evitar retries agressivos
      return res.status(200).json({ status: "not-approved" });
    }

    // Pegue os dados necessários da transação
    const external_reference = payment.external_reference; // seu id do pedido
    const meta = payment.metadata || {};

    // ✅ AQUI ESTÁ A MUDANÇA: buscar dados nos metadados enviados na preferência
    const produtos = meta.produtos;
    const cliente = meta.cliente;
    const total = meta.total;

    if (!produtos || !cliente || !total) {
      // Fallback ideal: buscar em seu DB por external_reference
      console.error("❌ Metadados ausentes no pagamento. external_reference:", external_reference);
      return res.status(400).json({ error: "Dados do pedido não encontrados nos metadados" });
    }

    // (Opcional) Validações adicionais de segurança
    // - payment.transaction_amount === Number(total)
    // - payment.currency_id === "BRL"
    // - conferir external_reference

    const payload = {
      gateway: "offline",
      payment_status: "paid",
      paid_at: new Date().toISOString().replace("Z", "-03:00"),
      products: produtos.map((item) => ({
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
        province: "SP", // ajuste se tiver UF real
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
      shipping_cost_customer: 10.0, // ajuste se tiver cálculo real
      total: Number(total),
      owner_note: `Baixa via Mercado Pago Checkout Pro - Payment ID: ${payment.id}, Ref: ${external_reference}`,
    };

    // Cria ordem na Nuvemshop
    const response = await axios.post("/orders", payload);
    console.log("✅ Ordem criada na Nuvemshop:", response.data?.id);

    return res.status(200).json({ status: "received" });
  } catch (error) {
    console.error(
      "❌ Erro ao processar webhook:",
      error?.response?.data || error.message || error
    );
    // Ainda retornamos 200 para o MP não fazer retry infinito enquanto corrigimos
    return res.status(200).json({ status: "error-logged" });
  }
});

/* ------------------------------ FUNÇÃO DE VERIFICAÇÃO HMAC (Nuvemshop) ------------------------------ */
function verifyWebhook(rawBody, hmacHeader) {
  if (!hmacHeader) return false;
  const calculatedHmac = crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("base64");
  return hmacHeader === calculatedHmac;
}

/* ------------------------------ LGPD: STORE REDACT ------------------------------ */
router.post("/store-redact", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader =
    req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];

  if (!verifyWebhook(rawBody, hmacHeader)) {
    console.error("❌ HMAC inválido em store-redact");
    return res.status(401).send("Assinatura inválida");
  }

  const { store_id } = JSON.parse(rawBody);
  console.log(`🧹 LGPD: Deletando dados da loja ${store_id}`);
  return res.status(200).send("OK");
});

/* ------------------------------ LGPD: CUSTOMERS REDACT ------------------------------ */
router.post("/customers-redact", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader =
    req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];

  if (!verifyWebhook(rawBody, hmacHeader)) {
    console.error("❌ HMAC inválido em customers-redact");
    return res.status(401).send("Assinatura inválida");
  }

  const { store_id, customer, orders_to_redact } = JSON.parse(rawBody);
  console.log(
    `🧹 LGPD: Deletando dados do cliente ${customer?.id} da loja ${store_id}, pedidos: ${orders_to_redact}`
  );
  return res.status(200).send("OK");
});

/* ------------------------------ LGPD: CUSTOMERS DATA REQUEST ------------------------------ */
router.post("/customers-data-request", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader =
    req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];

  if (!verifyWebhook(rawBody, hmacHeader)) {
    console.error("❌ HMAC inválido em customers-data-request");
    return res.status(401).send("Assinatura inválida");
  }

  const { store_id, customer } = JSON.parse(rawBody);
  console.log(`📄 LGPD: Requisição de dados do cliente ${customer?.id} da loja ${store_id}`);
  return res.status(200).send("OK");
});

module.exports = router;
