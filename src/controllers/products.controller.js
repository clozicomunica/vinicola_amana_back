const {
  fetchProducts,
  fetchProductById,
} = require("../services/nuvemshop.service");

// Lista todos os produtos
async function listProducts(req, res, next) {
  try {
    const { page = 1, per_page = 10, published = true } = req.query;
    const data = await fetchProducts({ page, per_page, published });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// Busca um produto por ID
async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const data = await fetchProductById(id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ✅ NOVA FUNÇÃO: Buscar produtos similares
async function getSimilarProducts(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Busca o produto atual
    const currentProduct = await fetchProductById(id);
    if (!currentProduct) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    // 2. Busca outros produtos para comparar
    const allProducts = await fetchProducts({
      page: 1,
      per_page: 50, // pode aumentar esse número conforme necessidade
      published: true,
    });

    // 3. Aplica filtro de similaridade
    const similares = allProducts
      .filter((p) => p.id !== currentProduct.id) // ignora o próprio
      .filter((p) => {
        const categoriaAtual = currentProduct.categories?.[0]?.name?.pt;
        const categoriaProduto = p.categories?.[0]?.name?.pt;
        const mesmaCategoria = categoriaProduto === categoriaAtual;

        // você pode comentar isso se "region" não existir nos seus dados
        const regiaoAtual = currentProduct.region;
        const regiaoProduto = p.region;
        const mesmaRegiao =
          regiaoAtual && regiaoProduto && regiaoProduto === regiaoAtual;

        const precoAtual = parseFloat(
          currentProduct.variants?.[0]?.price || "0"
        );
        const precoProduto = parseFloat(p.variants?.[0]?.price || "0");
        const precoSimilar =
          Math.abs(precoAtual - precoProduto) <= precoAtual * 0.3;

        return mesmaCategoria && (mesmaRegiao || precoSimilar);
      })
      .slice(0, 6); // retorna até 6 similares

    res.json(similares);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProductById,
  getSimilarProducts, // 👈 importante: exportar a nova função!
};
