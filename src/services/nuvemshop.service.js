const api = require("../utils/axiosClient");

// Mapeamento fixo de categorias para category_id baseado nos dados da Nuvemshop
const categoryMap = {
  tinto: 31974513,
  branco: 31974513,
  rose: 31974513,
  rosé: 31974513,
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

const WINE_TYPES = ["tinto", "branco", "rose", "rosé"];

// Função para limpar strings: minúsculas, remove acentos e trim espaços
function cleanString(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function fetchProducts({ page, per_page, published, category, search }) {
  const params = {
    page,
    per_page,
    published,
  };

  const normalizedCategory = category ? cleanString(category) : null;
  const isWineType = normalizedCategory && WINE_TYPES.includes(normalizedCategory);

  if (category && categoryMap[normalizedCategory]) {
    if (!isWineType) {
      params.category_id = categoryMap[normalizedCategory];
    } else {
      // Para tinto, branco e rose, usa categoria pai e filtra localmente
      params.category_id = 31974513;
    }
  } else if (category) {
    console.warn(
      `Categoria "${category}" não encontrada no mapeamento. Ignorando filtro.`
    );
  }

  if (search) {
    params.q = search;
  }

  const response = await api.get("/products", { params });

  let products = response.data;

  if (isWineType) {
    const normalizedType = normalizedCategory;
    products = products.filter((product) =>
      product.variants.some((variant) =>
        variant.values.some((value) => {
          const valPt = cleanString(value.pt || "");
          return valPt === normalizedType || valPt === cleanString("rosé");
        })
      )
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
