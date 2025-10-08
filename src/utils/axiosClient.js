const axios = require("axios");
require("dotenv").config();

const { getValidAccessToken } = require("../tokenManager");

const USER_AGENT = process.env.NUVEMSHOP_USER_AGENT;
const STORE_ID = process.env.NUVEMSHOP_STORE_ID;
const BASE_URL = `https://api.tiendanube.com/v1/${STORE_ID}`;

if (!USER_AGENT || !STORE_ID) {
  throw new Error(
    "Variáveis de ambiente NUVEMSHOP_USER_AGENT e NUVEMSHOP_STORE_ID são obrigatórias"
  );
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getValidAccessToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

module.exports = api;
