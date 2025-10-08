const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");

const TOKEN_FILE = path.resolve(__dirname, "..", "tokens.json");

const FALLBACK_ACCESS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN;

const {
  NUVEMSHOP_CLIENT_ID,
  NUVEMSHOP_CLIENT_SECRET,
  NUVEMSHOP_STORE_ID,
  NUVEMSHOP_USER_AGENT,
} = process.env;

async function readTokens() {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Não foi possível ler tokens.json:", error.message);
    }
    return null;
  }
}

async function saveTokens(tokens) {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

function isTokenExpired(expires_at) {
  if (!expires_at) return false;
  return Date.now() >= expires_at;
}

async function refreshAccessToken(refresh_token) {
  const response = await axios.post(
    "https://www.nuvemshop.com.br/apps/token",
    null,
    {
      params: {
        client_id: NUVEMSHOP_CLIENT_ID,
        client_secret: NUVEMSHOP_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token,
      },
      headers: {
        "User-Agent": NUVEMSHOP_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const {
    access_token,
    refresh_token: new_refresh,
    expires_in,
  } = response.data;

  const expires_at = Date.now() + expires_in * 1000;

  const newTokens = {
    access_token,
    refresh_token: new_refresh,
    expires_at,
  };

  await saveTokens(newTokens);
  return newTokens;
}

async function getValidAccessToken() {
  const tokens = await readTokens();

  if (!tokens || !tokens.access_token) {
    if (FALLBACK_ACCESS_TOKEN) {
      return FALLBACK_ACCESS_TOKEN;
    }

    throw new Error(
      "Nenhum token de acesso disponível. Gere o tokens.json ou defina NUVEMSHOP_ACCESS_TOKEN."
    );
  }

  if (isTokenExpired(tokens.expires_at)) {
    if (!tokens.refresh_token) {
      console.warn(
        "Token expirado e sem refresh_token disponível. Usando token armazenado mesmo assim."
      );
      return tokens.access_token;
    }

    console.log("🔄 Token expirado. Renovando...");
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    return newTokens.access_token;
  }

  return tokens.access_token;
}

module.exports = {
  getValidAccessToken,
};
