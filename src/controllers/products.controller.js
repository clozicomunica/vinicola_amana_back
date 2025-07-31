const {
  fetchProducts,
  fetchProductById,
} = require("../services/nuvemshop.service");

async function listProducts(req, res, next) {
  try {
    const { page = 1, per_page = 10, published = true } = req.query;
    const data = await fetchProducts({ page, per_page, published });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const data = await fetchProductById(id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProductById,
};
