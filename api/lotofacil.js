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

function criarRespostaProximoConcurso(ultimoResultado, concursoSolicitado) {
  const proximoConcurso = ultimoResultado.proximoConcurso || Number(concursoSolicitado);
  return {
    tipo: "proximo_concurso",
    concursoSolicitado: Number(concursoSolicitado),
    proximoConcurso,
    dataProximoConcurso: ultimoResultado.dataProximoConcurso,
    horarioProximoConcurso: ultimoResultado.horarioProximoConcurso,
    estimativaProximoConcurso: ultimoResultado.estimativaProximoConcurso,
    valorApostaMinima: 3.5,
    ultimoResultado,
    fonte: ultimoResultado.fonte,
    consultadoEm: new Date().toISOString()
  };
}

async function consultarFonte(base, concurso = "") {
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

async function consultarPrimeiraFonteDisponivel(concurso = "") {
  let ultimoErro;
  for (const fonte of FONTES) {
    try {
      return await consultarFonte(fonte, concurso);
    } catch (erro) {
      ultimoErro = erro;
      console.warn(`Falha na fonte ${fonte}:`, erro.message);
    }
  }
  throw ultimoErro || new Error("Fontes indisponíveis");
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

  try {
    if (!concurso) {
      const ultimoResultado = await consultarPrimeiraFonteDisponivel();
      return res.status(200).json(ultimoResultado);
    }

    const solicitado = Number(concurso);

    try {
      const resultadoSolicitado = await consultarPrimeiraFonteDisponivel(concurso);

      if (resultadoSolicitado.concurso === solicitado) {
        return res.status(200).json(resultadoSolicitado);
      }

      if (solicitado > resultadoSolicitado.concurso) {
        return res.status(200).json(criarRespostaProximoConcurso(resultadoSolicitado, solicitado));
      }
    } catch (erroConsultaDireta) {
      console.warn(`Consulta direta do concurso ${concurso} falhou:`, erroConsultaDireta.message);
    }

    const ultimoResultado = await consultarPrimeiraFonteDisponivel();

    if (solicitado > ultimoResultado.concurso) {
      return res.status(200).json(criarRespostaProximoConcurso(ultimoResultado, solicitado));
    }

    return res.status(404).json({
      erro: `O concurso ${concurso} não foi encontrado na fonte oficial. Verifique o número e tente novamente.`
    });
  } catch (erro) {
    console.error("Falha ao consultar a Lotofácil:", erro.message);
    return res.status(503).json({
      erro: "A consulta oficial está temporariamente indisponível. Tente novamente em alguns minutos.",
      detalhe: process.env.NODE_ENV === "development" ? erro.message : undefined
    });
  }
};
