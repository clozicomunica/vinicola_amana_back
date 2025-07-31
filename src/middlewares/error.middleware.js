module.exports = (err, req, res, next) => {
  console.error(err);

  res.status(err.response?.status || 500).json({
    error: true,
    message:
      err.response?.data?.message || err.message || "Erro interno no servidor",
  });
};
