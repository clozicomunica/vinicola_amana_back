// routes/webhooks.routes.js
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");
const axios = require("../utils/axiosClient"); // seu client p/ Nuvemshop
const crypto = require("crypto");
require("dotenv").config();

/** =================== MERCADO PAGO CONFIG =================== */
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "", // TEST-... em sandbox / APP_USR-... em prod
});
const MP_MODE = process.env.MP_MODE || "test"; // "test" | "prod"

/** ================ NUVEMSHOP / LGPD CONFIG ================== */
const APP_SECRET = process.env.NUVEMSHOP_CLIENT_SECRET || "";

/** ===================================================================
 *  HEALTHCHECK (alguns provedores pingam GET só pra checar disponibilidade)
 * ====================================================================*/
router.get("/order-paid", (req, res) => res.status(200).send("OK"));

/** ===================================================================
 *  MERCADO PAGO — WEBHOOK DE PAGAMENTO
 *  Observações:
 *   - MP pode enviar:
 *      1) IPN antigo:   GET/POST ?type=payment&id=123
 *      2) JSON novo A:  { "type": "payment", "data": { "id": "123" } }
 *      3) JSON novo B:  { "action": "...", "data": { "id": "123" } }
 *   - Esta rota usa um parser JSON **apenas aqui** para não conflitar com LGPD (raw).
 * ====================================================================*/
router.post(
  "/order-paid",
  // aceita application/json, text/plain e */* (há variação por gateway/proxy)
  express.json({ type: ["application/json", "text/plain", "*/*"] }),
  async (req, res) => {
    try {
      // 1) Descobrir o payment_id em qualquer formato
      const q = req.query || {};
      const b = req.body || {};

      // IPN antigo (query)
      let paymentId = q.id || q["data.id"];

      // Formatos novos
      if (!paymentId) paymentId = b?.data?.id || b?.id;

      // Nada de ID → só confirma recebimento pro MP não ficar em retry infinito
      if (!paymentId) {
        console.log("[MP Webhook] payload sem id. Ignorado.");
        return res.status(200).json({ status: "ignored-no-id" });
      }

      // 2) Buscar o pagamento no MP
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: String(paymentId) });

      console.log(
        "[MP Webhook] payment_id:", payment.id,
        "status:", payment.status,
        "env:", MP_MODE
      );

      // 3) Só processa quando aprovado
      if (payment.status !== "approved") {
        return res.status(200).json({ status: "not-approved" });
      }

      // 4) Pega dados que você enviou na preferência (metadata)
      const meta = payment.metadata || {};
      const produtos = meta.produtos;
      const cliente  = meta.cliente;
      const total    = meta.total;

      if (!produtos || !cliente || typeof total === "undefined") {
        // Se necessário, aqui você poderia recuperar dados pelo external_reference no seu DB
        console.error("❌ Metadados ausentes no pagamento:", {
          external_reference: payment.external_reference,
        });
        return res.status(200).json({ status: "missing-metadata" });
      }

      // 5) (opcional) validações extras de segurança
      // if (Number(payment.transaction_amount) !== Number(total)) { ... }
      // if (payment.currency_id !== "BRL") { ... }

      // 6) Monta payload para criar ordem na Nuvemshop
      const uf = cliente.state || "SP";
      const isoNow = new Date().toISOString(); // deixe ISO; se precisar -03:00, trate no app de destino

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
          province: uf,      // UF
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
        shipping_cost_customer: 10.0, // ajuste se tiver cálculo real de frete
        total: Number(total || 0),
        owner_note: `Baixa via Mercado Pago Checkout Pro - Payment ID: ${payment.id}, Ref: ${payment.external_reference || "-"}`,
      };

      // 7) Cria a ordem na Nuvemshop
      const nsResp = await axios.post("/orders", payload);
      console.log("✅ Ordem criada na Nuvemshop:", nsResp?.data?.id);

      // 8) Responde OK ao MP
      return res.status(200).json({ status: "received" });
    } catch (error) {
      // Importante: sempre responder 200 para não gerar retry agressivo do MP
      console.error("❌ Erro ao processar webhook MP:", error?.response?.data || error?.message || error);
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
 *  LGPD — STORE REDACT
 *  (usa RAW para validar HMAC)
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
