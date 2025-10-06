const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");
const axios = require("../utils/axiosClient");
require("dotenv").config();
const crypto = require("crypto");

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const APP_SECRET = process.env.NUVEMSHOP_CLIENT_SECRET;


const tempStorage = new Map();

/* ------------------------------ PAGAMENTO APROVADO ------------------------------ */
router.post("/order-paid", async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment") {
    try {
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: data.id });

      if (payment.status === "approved") {
        const external_reference = payment.external_reference;
        const orderData = tempStorage.get(external_reference);

        if (!orderData) {
          console.error("❌ Dados do pedido não encontrados:", external_reference);
          return res.status(400).json({ error: "Dados do pedido não encontrados" });
        }

        const { produtos, cliente, total } = orderData;

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
            address: cliente.address || "Rua Exemplo, 123",
            city: cliente.city || "São Paulo",
            province: "SP",
            country: "BR",
            zipcode: cliente.zipcode || "01000000",
          },
          shipping_address: {
            address: cliente.address || "Rua Exemplo, 123",
            city: cliente.city || "São Paulo",
            province: "SP",
            country: "BR",
            zipcode: cliente.zipcode || "01000000",
          },
          shipping_pickup_type: "ship",
          shipping: "Correios",
          shipping_option: "PAC",
          shipping_cost_customer: 10.0,
          total,
          owner_note: `Baixa via Mercado Pago Checkout Pro - Payment ID: ${data.id}`,
        };

        const response = await axios.post("/orders", payload);
        tempStorage.delete(external_reference);

        console.log("✅ Ordem criada na Nuvemshop:", response.data.id);
      }

      return res.status(200).json({ status: "received" });
    } catch (error) {
      console.error("❌ Erro ao processar webhook:", error.response?.data || error.message);
      return res.status(500).json({ error: "Erro ao processar webhook" });
    }
  } else {
    return res.status(200).json({ status: "ignored" });
  }
});

/* ------------------------------ FUNÇÃO DE VERIFICAÇÃO HMAC ------------------------------ */
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
  const hmacHeader = req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];

  if (!verifyWebhook(rawBody, hmacHeader)) {
    console.error("❌ HMAC inválido em store-redact");
    return res.status(401).send("Assinatura inválida");
  }

  const { store_id } = JSON.parse(rawBody);
  console.log(`🧹 LGPD: Deletando dados da loja ${store_id}`);

  // Aqui você deve remover tokens, cache e dados da loja no seu banco
  // ex: await db.stores.delete(store_id);

  return res.status(200).send("OK");
});

/* ------------------------------ LGPD: CUSTOMERS REDACT ------------------------------ */
router.post("/customers-redact", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader = req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];

  if (!verifyWebhook(rawBody, hmacHeader)) {
    console.error("❌ HMAC inválido em customers-redact");
    return res.status(401).send("Assinatura inválida");
  }

  const { store_id, customer, orders_to_redact } = JSON.parse(rawBody);
  console.log(`🧹 LGPD: Deletando dados do cliente ${customer?.id} da loja ${store_id}, pedidos: ${orders_to_redact}`);

  // Exemplo:
  // await db.customers.delete(customer.id);
  // await db.orders.deleteMany(orders_to_redact);

  return res.status(200).send("OK");
});

/* ------------------------------ LGPD: CUSTOMERS DATA REQUEST ------------------------------ */
router.post("/customers-data-request", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body.toString("utf-8");
  const hmacHeader = req.headers["x-linkedstore-hmac-sha256"] || req.headers["http_x_linkedstore_hmac_sha256"];

  if (!verifyWebhook(rawBody, hmacHeader)) {
    console.error("❌ HMAC inválido em customers-data-request");
    return res.status(401).send("Assinatura inválida");
  }

  const { store_id, customer, orders_requested, checkouts_requested, drafts_orders_requested, data_request } = JSON.parse(rawBody);
  console.log(`📄 LGPD: Requisição de dados do cliente ${customer?.id} da loja ${store_id}`);

  // Aqui você deve buscar os dados do cliente no seu DB e enviá-los ao lojista (não para a Nuvemshop)
  // Ex: const report = await db.getCustomerData(customer.id, { orders_requested, checkouts_requested, drafts_orders_requested });
  // Ex: enviar por email com nodemailer ou API interna

  return res.status(200).send("OK");
});

module.exports = router;
