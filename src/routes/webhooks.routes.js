const express = require("express");
const router = express.Router();

router.post("/order-paid", async (req, res) => {
  const event = req.body;
  console.log("Webhook recebido: Ordem paga!", event); // Aqui, atualize seu banco ou estoque se necessário
  // Ex.: if (event.type === 'order/paid') { atualizeOrdem(event.data.id); }
  res.sendStatus(200); // Responda 200 para confirmar recebimento
});

module.exports = router;