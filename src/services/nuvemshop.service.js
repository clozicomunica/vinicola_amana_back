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

// Função para limpar strings: minúsculas, remove acentos e trim espaços
function cleanString(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function fetchProducts({ page, per_page, published, category, search }) {
  let params = {
    page,
    per_page,
    published,
  };

  const categoryLower = category ? category.toLowerCase() : null;
  const isWineType =
    categoryLower &&
    ["tinto", "branco", "rose", "rosé"].includes(categoryLower);

  if (category && categoryMap[categoryLower]) {
    if (!isWineType) {
      params.category_id = categoryMap[categoryLower];
      console.log(
        `Filtro por categoria aplicado: category_id = ${params.category_id}`
      );
    } else {
      // Para tinto, branco e rose, usa categoria pai e filtra localmente
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

  // Debug: log valores das variações para verificar "Rosé" etc
  products.forEach((product) => {
    product.variants.forEach((variant) => {
      variant.values.forEach((value) => {
        console.log(`Variant value.pt original: "${value.pt}"`);
      });
    });
  });

  if (isWineType) {
    const normalizedType = cleanString(category);

    products = products.filter((product) =>
      product.variants.some((variant) =>
        variant.values.some((value) => {
          const valPt = cleanString(value.pt || "");
          return valPt === normalizedType || valPt === cleanString("rosé");
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
