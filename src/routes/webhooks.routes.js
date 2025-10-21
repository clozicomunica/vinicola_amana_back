// routes/webhooks.routes.js
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");
// Ajuste o caminho do axios da Nuvemshop conforme seu projeto:
const axios = require("../utils/axiosClient"); // ou: require("../axiosClient")
const crypto = require("crypto");
require("dotenv").config();

/** =================== MERCADO PAGO CONFIG =================== */
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "", // APP_USR-... ou TEST-...
});
const MP_MODE = process.env.MP_MODE || "test"; // "test" | "prod"

/** ================ NUVEMSHOP / LGPD CONFIG ================== */
const APP_SECRET = process.env.NUVEMSHOP_CLIENT_SECRET || "";

/** ===================================================================
 *  HEALTHCHECK
 * ====================================================================*/
router.get("/order-paid", (req, res) => res.status(200).send("OK"));

/** ===================================================================
 *  MERCADO PAGO — WEBHOOK DE PAGAMENTO
 *  Formatos aceitos:
 *    - IPN antigo:   GET/POST ?type=payment&id=123
 *    - JSON novo A:  { "type": "payment", "data": { "id": "123" } }
 *    - JSON novo B:  { "action": "...", "data": { "id": "123" } }
 * ====================================================================*/
router.post(
  "/order-paid",
  // aceita application/json, text/plain e */*
  express.json({ type: ["application/json", "text/plain", "*/*"] }),
  async (req, res) => {
    try {
      const q = req.query || {};
      const b = req.body || {};

      // 1) Descobrir o payment_id em qualquer formato
      let paymentId =
        q.id ||
        q["data.id"] ||
        b?.data?.id ||
        b?.id ||
        b?.payment_id;

      if (!paymentId) {
        console.warn("[MP Webhook] Payload sem id. Ignorado.", { query: q, body: b });
        return res.status(200).json({ status: "ignored-no-id" });
      }

      // 2) Buscar o pagamento no MP
      const paymentClient = new Payment(mpClient);
      let payment;
      try {
        payment = await paymentClient.get({ id: String(paymentId) });
      } catch (err) {
        console.error("[MP Webhook] Falha ao buscar payment no MP:", err?.response?.data || err?.message || err);
        // Responde 200 para não gerar retry infinito enquanto você depura
        return res.status(200).json({ status: "mp-fetch-error" });
      }

      console.log("[MP Webhook] OK", {
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        mode: MP_MODE,
        pref: payment.preference_id,
        ext_ref: payment.external_reference,
      });

      // 3) Só processa quando aprovado
      if (payment.status !== "approved") {
        return res.status(200).json({ status: "not-approved", payment_status: payment.status });
      }

      // 4) Metadados enviados na preferência
      const meta = payment.metadata || {};
      const produtos = meta.produtos;
      const cliente  = meta.cliente;
      const total    = meta.total;

      if (!produtos || !cliente || typeof total === "undefined") {
        console.error("❌ Metadados ausentes no pagamento:", {
          preference_id: payment.preference_id,
          external_reference: payment.external_reference,
        });
        // Se você usa DB próprio, aqui poderia recuperar pelo external_reference
        return res.status(200).json({ status: "missing-metadata" });
      }

      // (Opcional) Validações extras
      // if (Number(payment.transaction_amount) !== Number(total)) { ... }
      // if (payment.currency_id !== "BRL") { ... }

      // 5) Monta payload para criar ordem na Nuvemshop
      const uf = cliente.state || "SP";
      const isoNow = new Date().toISOString();

      const payload = {
        gateway: "offline",
        payment_status: "paid",
        paid_at: isoNow,
        products: (produtos || []).map((item) => ({
          variant_id: item.variant_id || 0,
          quantity: Number(item.quantity || 1),
          price: Number(item.price || 0),
        })),
        customer: {
          name: cliente.name || "",
          email: cliente.email || "",
          identification: cliente.document
            ? { type: "CPF", number: String(cliente.document) }
            : undefined,
        },
        billing_address: {
          address: cliente.address || "",
          city: cliente.city || "",
          province: uf, // UF
          country: "BR",
          zipcode: cliente.zipcode || "",
        },
        shipping_address: {
          address: cliente.address || "",
          city: cliente.city || "",
          province: uf,
          country: "BR",
          zipcode: cliente.zipcode || "",
        },
        shipping_pickup_type: "ship",
        shipping: "Correios",
        shipping_option: "PAC",
        shipping_cost_customer: 10.0, // ajuste conforme seu cálculo real de frete
        total: Number(total || 0),
        owner_note: `Baixa via Mercado Pago Checkout Pro - Payment ID: ${payment.id}, Ref: ${payment.external_reference || "-"}`,
      };

      // 6) Cria a ordem na Nuvemshop
      try {
        const nsResp = await axios.post("/orders", payload);
        console.log("✅ Ordem criada na Nuvemshop:", nsResp?.data?.id);
      } catch (e) {
        console.error("❌ Erro ao criar ordem na Nuvemshop:", e?.response?.data || e?.message || e);
        // Mesmo com erro na Nuvemshop, responda 200 ao MP para evitar repetição excessiva
        return res.status(200).json({ status: "nuvemshop-error-logged" });
      }

      // 7) Responde OK ao MP
      return res.status(200).json({ status: "received" });
    } catch (error) {
      console.error("❌ Erro inesperado no webhook MP:", error?.response?.data || error?.message || error);
      // Importante: normalmente manter 200 evita retry agressivo; mude para 500 se quiser forçar retry durante debug
      return res.status(200).json({ status: "error-logged" });
    }
  }
);

/** ===================================================================
 *  FUNÇÕES AUXILIARES — HMAC (LGPD / Nuvemshop)
 * ====================================================================*/
function verifyWebhook(rawBody, hmacHeader) {
  if (!APP_SECRET || !hmacHeader) return false;
  const calculatedHmac = crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("base64");
  return hmacHeader === calculatedHmac;
}

/** ===================================================================
 *  LGPD — STORE REDACT (usa RAW para validar HMAC)
 * ====================================================================*/
router.post("/store-redact", express.raw({ type: "application/json" }), async (req, res) => {
  try {
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
  } catch (e) {
    console.error("store-redact error:", e);
    return res.status(200).send("logged");
  }
});

/** ===================================================================
 *  LGPD — CUSTOMERS REDACT
 * ====================================================================*/
router.post("/customers-redact", express.raw({ type: "application/json" }), async (req, res) => {
  try {
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
  } catch (e) {
    console.error("customers-redact error:", e);
    return res.status(200).send("logged");
  }
});

/** ===================================================================
 *  LGPD — CUSTOMERS DATA REQUEST
 * ====================================================================*/
router.post("/customers-data-request", express.raw({ type: "application/json" }), async (req, res) => {
  try {
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
  } catch (e) {
    console.error("customers-data-request error:", e);
    return res.status(200).send("logged");
  }
});

module.exports = router;
