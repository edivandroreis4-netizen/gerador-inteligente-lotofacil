const FONTES = [
  "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil",
  "https://servicebus3.caixa.gov.br/portaldeloterias/api/lotofacil"
];

function normalizarResultado(dados) {
  const dezenas = Array.isArray(dados?.listaDezenas)
    ? dados.listaDezenas.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    : [];

  if (!Number.isInteger(Number(dados?.numero)) || dezenas.length !== 15) {
    throw new Error("A fonte oficial retornou dados em formato inesperado.");
  }

  return {
    concurso: Number(dados.numero),
    data: dados.dataApuracao || null,
    dezenas,
    acumulado: Boolean(dados.acumulado),
    proximoConcurso: dados.numeroConcursoProximo ? Number(dados.numeroConcursoProximo) : null,
    dataProximoConcurso: dados.dataProximoConcurso || null,
    horarioProximoConcurso: "21h",
    estimativaProximoConcurso: Number(dados.valorEstimadoProximoConcurso || 0),
    premiacao: Array.isArray(dados.listaRateioPremio)
      ? dados.listaRateioPremio.map((faixa) => ({
          descricao: faixa.descricaoFaixa || null,
          ganhadores: Number(faixa.numeroDeGanhadores || 0),
          valor: Number(faixa.valorPremio || 0)
        }))
      : [],
    fonte: "Portal Loterias CAIXA",
    consultadoEm: new Date().toISOString()
  };
}

async function consultarFonte(base, concurso) {
  const url = concurso ? `${base}/${concurso}` : base;
  const resposta = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Gerador-Inteligente-Lotofacil/2.3.2"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const texto = await resposta.text();
  let dados;
  try { dados = JSON.parse(texto); }
  catch { throw new Error("Resposta não JSON"); }
  return normalizarResultado(dados);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const concursoBruto = Array.isArray(req.query?.concurso) ? req.query.concurso[0] : req.query?.concurso;
  const concurso = concursoBruto ? String(concursoBruto).replace(/\D/g, "") : "";
  let ultimoErro;

  for (const fonte of FONTES) {
    try {
      const resultado = await consultarFonte(fonte, concurso);
      return res.status(200).json(resultado);
    } catch (erro) {
      ultimoErro = erro;
      console.warn(`Falha na fonte ${fonte}:`, erro.message);
    }
  }

  return res.status(503).json({
    erro: concurso
      ? `O concurso ${concurso} não pôde ser consultado agora.`
      : "A consulta oficial está temporariamente indisponível.",
    detalhe: process.env.NODE_ENV === "development" ? ultimoErro?.message : undefined
  });
};
