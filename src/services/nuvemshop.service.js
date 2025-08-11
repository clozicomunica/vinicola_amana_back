const express = require("express");
const api = require("../utils/axiosClient"); // ajuste o caminho conforme seu projeto

const app = express();
const port = process.env.PORT || 3000;

const categoryMap = {
  tinto: 31974513, // Categoria pai "Vinho"
  branco: 31974513,
  rose: 31974513,
  amana: 31974539,
  una: 31974540,
  singular: 32613020,
  cafe: 31974516,
  "em grao": 31974553,
  "em po": 31974549,
  diversos: 31974526,
  experiencias: 31974528,
  "vale-presente": 31974530,
};

async function fetchProducts({
  page,
  per_page,
  published,
  category,
  search,
  type,
}) {
  let params = {
    page,
    per_page,
    published,
  };

  if (
    category &&
    categoryMap[category.toLowerCase()] &&
    !["tinto", "branco", "rose"].includes(category.toLowerCase())
  ) {
    params.category_id = categoryMap[category.toLowerCase()];
    console.log(
      `Filtro por categoria aplicado: category_id = ${params.category_id}`
    );
  } else if (
    category &&
    !["tinto", "branco", "rose"].includes(category.toLowerCase())
  ) {
    console.warn(
      `Categoria "${category}" não encontrada no mapeamento. Ignorando filtro.`
    );
  }

  if (search) {
    params.q = search;
    console.log(`Filtro por busca aplicado: q = ${params.q}`);
  }

  console.log("Parâmetros enviados pra API da Nuvemshop:", params);
  const response = await api.get("/products", { params });
  let products = response.data;

  if (type) {
    const normalizedType = type
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    products = products.filter((product) =>
      product.variants.some((variant) =>
        variant.values.some((value) => {
          const valPt = value.pt
            ?.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          return valPt === normalizedType;
        })
      )
    );
    console.log(
      `Filtro por tipo aplicado: type = ${type}, produtos após filtro: ${products.length}`
    );
  }

  return products;
}

// Rota para buscar produtos
app.get("/api/products", async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 8,
      published = true,
      category,
      search,
      type,
    } = req.query;

    const products = await fetchProducts({
      page: Number(page),
      per_page: Number(per_page),
      published: published === "true" || published === true,
      category,
      search,
      type,
    });

    res.json(products);
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// Se estiver rodando esse arquivo diretamente, inicia o servidor
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

// Exporta a função para ser usada em outros lugares, se quiser
module.exports = {
  fetchProducts,
  app,
};
