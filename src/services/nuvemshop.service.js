const api = require("../utils/axiosClient");

// Mapeamento fixo de categorias para category_id baseado nos dados da Nuvemshop
const categoryMap = {
  tinto: 31974513, // Mapeia pra "Vinho" como categoria pai (ajuste se tiver subcategoria específica)
  branco: 31974513, // Mapeia pra "Vinho" como categoria pai (ajuste se tiver subcategoria específica)
  rose: 31974513, // Mapeia pra "Vinho" como categoria pai (ajuste se tiver subcategoria específica)
  amana: 31974539, // Subcategoria de Vinho
  una: 31974540, // Subcategoria de Vinho
  singular: 32613020, // Subcategoria de Vinho
  cafe: 31974516, // Categoria Café
  "em grao": 31974553, // Subcategoria de Café
  "em po": 31974549, // Subcategoria de Café
  diversos: 31974526, // Categoria Diversos
  experiencias: 31974528, // Categoria Experiências
  "vale-presente": 31974530, // Categoria Vale Presente
};

async function fetchProducts({ page, per_page, published, category, search }) {
  let params = {
    page,
    per_page,
    published,
  };

  // Adiciona filtro por categoria se fornecido
  if (category && categoryMap[category.toLowerCase()]) {
    params.category_id = categoryMap[category.toLowerCase()];
    console.log(
      `Filtro por categoria aplicado: category_id = ${params.category_id}`
    );
  } else if (category) {
    console.warn(
      `Categoria "${category}" não encontrada no mapeamento. Ignorando filtro.`
    );
  }

  // Adiciona busca se fornecida
  if (search) {
    params.q = search; // Nuvemshop usa 'q' pra busca
    console.log(`Filtro por busca aplicado: q = ${params.q}`);
  }

  console.log("Parâmetros enviados pra API da Nuvemshop:", params);
  const response = await api.get("/products", { params });
  console.log(
    "Resposta da API da Nuvemshop:",
    response.data.length,
    "produtos retornados"
  );
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
