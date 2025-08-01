const axios = require("axios");
const { getValidAccessToken } = require("../tokenManager");
const USER_AGENT = process.env.NUVEMSHOP_USER_AGENT;
const STORE_ID = process.env.NUVEMSHOP_STORE_ID;
const BASE_URL = `https://api.nuvemshop.com.br/v1/${STORE_ID}`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor: antes de cada requisição, define o token válido
api.interceptors.request.use(async (config) => {
  const token = await getValidAccessToken();
  config.headers.Authentication = `bearer ${token}`;
  return config;
});

module.exports = api;
