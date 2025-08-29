const express = require("express");
const axios = require("axios");
const fs = require("fs");
const router = express.Router();

const CLIENT_ID = process.env.NUVEMSHOP_CLIENT_ID;
const CLIENT_SECRET = process.env.NUVEMSHOP_CLIENT_SECRET;
const REDIRECT_URI = "https://vinicola-amana-back.onrender.com/auth/callback";

router.get("/callback", async (req, res) => {
  const { code, store_id } = req.query;

  if (!code || !store_id) {
    return res.status(400).send("Code ou Store ID ausente.");
  }

  try {
    const response = await axios.post(
      "https://www.nuvemshop.com.br/apps/token",
      null,
      {
        params: {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code", 
          code,
          redirect_uri: REDIRECT_URI,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, token_type, scope } = response.data;

    const tokenData = {
      store_id,
      access_token,
      refresh_token,
      token_type,
      scope,
      created_at: new Date().toISOString(),
    };

    fs.writeFileSync("tokens.json", JSON.stringify(tokenData, null, 2));

    res.send("✅ Tokens salvos com sucesso!");
  } catch (err) {
    console.error(
      "Erro ao trocar code por token:",
      err.response?.data || err.message
    );
    res.status(500).send("Erro ao obter os tokens.");
  }
});

module.exports = router;
