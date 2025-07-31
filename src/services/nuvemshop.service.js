const api = require("../utils/axiosClient");

async function fetchProducts({ page, per_page, published }) {
  const response = await api.get("/products", {
    params: {
      page,
      per_page,
      published,
    },
  });
  return response.data;
}

async function fetchProductById(id) {
  const response = await api.get(`/products/${id}`);
  return response.data;
}

module.exports = {
  fetchProducts,
  fetchProductById,
};
