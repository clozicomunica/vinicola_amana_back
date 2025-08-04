const {
  fetchProducts,
  fetchProductById,
  api,
} = require("../services/nuvemshop.service");

// Lista produtos
async function listProducts(req, res, next) {
  try {
    const {
      page = 1,
      per_page = 10,
      published = true,
      category,
      search,
    } = req.query;

    const data = await fetchProducts({
      page,
      per_page,
      published,
      category,
      search,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// Busca por ID
async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const data = await fetchProductById(id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// Produtos similares com fallback inteligente
async function getSimilarProducts(req, res, next) {
  try {
    const { id } = req.params;

    const currentProduct = await fetchProductById(id);
    if (!currentProduct) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const allProducts = await fetchProducts({
      page: 1,
      per_page: 50,
      published: true,
    });

    const outrosProdutos = allProducts.filter(
      (p) => p.id !== currentProduct.id
    );

    const categoriaAtual = currentProduct.categories?.[0]?.name?.pt;
    const regiaoAtual = currentProduct.region;
    const precoAtual = parseFloat(currentProduct.variants?.[0]?.price || "0");

    // 1️⃣ Produtos bem similares
    let similares = outrosProdutos.filter((p) => {
      const categoriaProduto = p.categories?.[0]?.name?.pt;
      const regiaoProduto = p.region;
      const precoProduto = parseFloat(p.variants?.[0]?.price || "0");

      const mesmaCategoria = categoriaProduto === categoriaAtual;
      const mesmaRegiao =
        regiaoAtual && regiaoProduto && regiaoProduto === regiaoAtual;
      const precoSimilar =
        Math.abs(precoAtual - precoProduto) <= precoAtual * 0.3;

      return mesmaCategoria && (mesmaRegiao || precoSimilar);
    });

    // 2️⃣ Relaxa filtro: mesma categoria
    if (similares.length === 0) {
      similares = outrosProdutos.filter((p) => {
        const categoriaProduto = p.categories?.[0]?.name?.pt;
        return categoriaProduto === categoriaAtual;
      });
    }

    // 3️⃣ Último recurso: qualquer outro produto
    if (similares.length === 0) {
      similares = outrosProdutos;
    }

    res.json(similares.slice(0, 6));
  } catch (err) {
    next(err);
  }
}

// Finaliza o pedido e redireciona pro checkout da Nuvemshop
async function checkoutOrder(req, res, next) {
  try {
    const { items, customer } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Itens do carrinho são obrigatórios" });
    }

    const cartItems = items.map((item) => ({
      product_id: item.id,
      quantity: item.quantity || 1,
      variant_id: item.variant_id || null,
    }));

    const customerData = {
      email: customer.email || "cliente@example.com",
      name: customer.name || "Cliente Anônimo",
      document: customer.document || "00000000000",
    };

    const response = await api.post("/carts", {
      items: cartItems,
      customer: customerData,
      redirect_url: "https://vinicola-amana-back.onrender.com/checkout-success",
      cancel_url: "https://vinicola-amana-back.onrender.com/checkout-cancel",
    });

    const checkoutUrl = response.data.checkout_url;
    if (checkoutUrl) {
      return res.redirect(303, checkoutUrl);
    } else {
      return res.status(500).json({ error: "URL de checkout não gerada" });
    }
  } catch (err) {
    console.error("Erro ao criar checkout:", err.response?.data || err.message);
    next(err);
  }
}

module.exports = {
  listProducts,
  getProductById,
  getSimilarProducts,
  checkoutOrder, // ✅ Nome certo para o router
};
