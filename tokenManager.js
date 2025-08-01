const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");

const TOKEN_FILE = path.join(__dirname, "tokens.json");

const {
  NUVEMSHOP_CLIENT_ID,
  NUVEMSHOP_CLIENT_SECRET,
  NUVEMSHOP_STORE_ID,
  NUVEMSHOP_USER_AGENT,
} = process.env;

async function readTokens() {
  const data = await fs.readFile(TOKEN_FILE, "utf-8");
  return JSON.parse(data);
}

async function saveTokens(tokens) {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

async function isTokenExpired(expires_at) {
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

  if (await isTokenExpired(tokens.expires_at)) {
    console.log("🔄 Token expirado. Renovando...");
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    return newTokens.access_token;
  }

  return tokens.access_token;
}

module.exports = {
  getValidAccessToken,
};
