const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");
const axios = require("../utils/axiosClient"); // Seu cliente Axios corrigido
require("dotenv").config();

// Configura Mercado Pago
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// Armazenamento temporário (deve ser o mesmo Map usado em orders.routes.js)
// ATENÇÃO: Em produção, use MongoDB/Redis, pois Map não persiste no Render
const tempStorage = new Map();

router.post("/order-paid", async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment") {
    try {
      const paymentClient = new Payment(mpClient);
      const payment = await paymentClient.get({ id: data.id });

      if (payment.status === "approved") {
        // Recupera dados do carrinho usando external_reference
        const external_reference = payment.external_reference;
        const orderData = tempStorage.get(external_reference);

        if (!orderData) {
          console.error("Dados do pedido não encontrados para external_reference:", external_reference);
          return res.status(400).json({ error: "Dados do pedido não encontrados" });
        }

        const { produtos, cliente, total } = orderData;

        // Cria ordem na Nuvemshop
        const payload = {
          gateway: "offline", // Mercado Pago não é gateway nativo
          payment_status: "paid",
          paid_at: new Date().toISOString().replace("Z", "-03:00"), // Horário Brasil
          products: produtos.map(item => ({
            variant_id: item.variant_id || 0, // Use IDs reais em produção
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
          shipping_cost_customer: 10.0, // Ajuste conforme necessário
          total,
          owner_note: `Baixa via Mercado Pago Checkout Pro - Payment ID: ${data.id}`,
        };

        const response = await axios.post("/orders", payload);

        // Limpa o armazenamento temporário após criar a ordem
        tempStorage.delete(external_reference);

        console.log("Ordem criada na Nuvemshop:", response.data.id);
      }

      res.status(200).json({ status: "received" });
    } catch (error) {
      console.error("Erro ao processar webhook:", error.response?.data || error.message);
      res.status(500).json({ error: "Erro ao processar webhook" });
    }
  } else {
    res.status(200).json({ status: "ignored" });
  }
});

module.exports = router;