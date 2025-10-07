// routes/orders.create-checkout.js (patch)
const { MercadoPagoConfig, Preference } = require("mercadopago");

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

module.exports = async function createCheckout(req, res) {
  try {
    const { produtos, cliente, total } = req.body;
    const orderId = `PED-${Date.now()}`;

    const prefClient = new Preference(mp);
    const pref = await prefClient.create({
      body: {
        items: [
          {
            title: "Pedido na Vinícola Amana",
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(total),
          },
        ],
        notification_url: `${process.env.BACKEND_URL}/webhooks/order-paid`,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/success`,
          pending: `${process.env.FRONTEND_URL}/pending`,
          failure: `${process.env.FRONTEND_URL}/failure`,
        },
        auto_return: "approved",
        external_reference: orderId,
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
      },
    });

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
