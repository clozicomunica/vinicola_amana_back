const api = require("../utils/axiosClient");

// Mapeamento fixo de categorias para category_id baseado nos dados da Nuvemshop
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

async function fetchProducts({ page, per_page, published, category, search }) {
  let params = {
    page,
    per_page,
    published,
  };

  // Se categoria for tinto, branco ou rose, usamos a categoria pai 31974513 e filtramos localmente depois
  const isWineType =
    category && ["tinto", "branco", "rose"].includes(category.toLowerCase());

  if (category && categoryMap[category.toLowerCase()]) {
    // Se for tipo vinho (tinto/branco/rose), busca categoria pai sem filtro extra na API
    if (!isWineType) {
      params.category_id = categoryMap[category.toLowerCase()];
      console.log(
        `Filtro por categoria aplicado: category_id = ${params.category_id}`
      );
    } else {
      // Para tinto/branco/rose, filtra depois, então só usa categoria pai
      params.category_id = 31974513;
      console.log(
        `Busca categoria pai "Vinho" para filtrar localmente: category_id = ${params.category_id}`
      );
    }
  } else if (category) {
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

  // Se for tipo vinho, filtra localmente pelos valores das variações
  if (isWineType) {
    const normalizedType = category
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
      `Após filtro local, ${products.length} produtos do tipo "${category}" encontrados.`
    );
  }

  return products;
}

async function fetchProductById(id) {
  const response = await api.get(`/products/${id}`);
  return response.data;
}

module.exports = {
  fetchProducts,
  fetchProductById,
  api,
};
