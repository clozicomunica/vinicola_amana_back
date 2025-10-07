// routes/orders.create-checkout.js
const { MercadoPagoConfig, Preference } = require("mercadopago");

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // APP_USR-... (produção)
});

module.exports = async function createCheckout(req, res) {
  try {
    const { produtos, cliente, total } = req.body;

    // Gera uma referência sua (pode ser o ID de um pré-pedido no seu DB)
    const orderId = `PED-${Date.now()}`;

    const prefClient = new Preference(mp);
    const pref = await prefClient.create({
      items: [
        {
          title: "Pedido na Vinícola Amana",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(total),
        },
      ],
      notification_url: `${process.env.BACK_URL}/webhooks/order-paid`,   // 👈 seu webhook
      back_urls: {
        success: `${process.env.FRONT_URL}/success`,            // 👈 páginas do FRONT
        pending: `${process.env.FRONT_URL}/pendente`,
        failure: `${process.env.FRONT_URL}/erro`,
      },
      auto_return: "approved",
      external_reference: orderId, // 👈 vai cair no payment.external_reference

      // 👇 DADOS que o webhook vai usar pra baixar na Nuvemshop
      metadata: {
        produtos: (produtos || []).map(p => ({
          variant_id: p.variant_id || 0,
          quantity: p.quantity,
          price: Number(p.price),
          name: p.name || "",
        })),
        cliente: {
          name: cliente?.name,
          email: cliente?.email,
          document: cliente?.document,
          address: cliente?.address,
          city: cliente?.city,
          zipcode: cliente?.zipcode,
        },
        total: Number(total),
      },
    });

    // Devolve ao front a URL do Checkout Pro
    return res.json({
      redirect_url: pref.init_point,
      external_reference: orderId,
      preference_id: pref.id,
    });
  } catch (e) {
    console.error("createPreference error:", e?.response?.data || e);
    return res.status(500).json({ error: "Falha ao criar preferência" });
  }
};
