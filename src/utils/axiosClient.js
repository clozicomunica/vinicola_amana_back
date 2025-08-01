const axios = require("axios");

const USER_AGENT = process.env.NUVEMSHOP_USER_AGENT;
const STORE_ID = process.env.NUVEMSHOP_STORE_ID;
const BASE_URL = `https://api.nuvemshop.com.br/v1/${STORE_ID}`;
const ACCESS_TOKEN = process.env.NUVEMSHOP_ACCESS_TOKEN;

if (!USER_AGENT || !STORE_ID || !ACCESS_TOKEN) {
  throw new Error(
    "Variáveis de ambiente NUVEMSHOP_USER_AGENT, STORE_ID e ACCESS_TOKEN são obrigatórias"
  );
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authentication: `bearer ${ACCESS_TOKEN}`,
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

module.exports = api;
