export async function buscarResultadoLotofacil(concurso = "") {
  const parametro = concurso ? `?concurso=${encodeURIComponent(concurso)}` : "";
  let resposta;

  try {
    resposta = await fetch(`/api/lotofacil${parametro}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
  } catch {
    throw new Error("Não foi possível acessar o servidor. Verifique sua conexão e tente novamente.");
  }

  const tipoConteudo = resposta.headers.get("content-type") || "";
  if (!tipoConteudo.includes("application/json")) {
    throw new Error("A API não retornou uma resposta válida. Teste pela versão publicada na Vercel.");
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch {
    throw new Error("Não foi possível interpretar a resposta da API.");
  }

  if (dados?.status === "futuro" || dados?.tipo === "proximo_concurso") {
    return dados;
  }

  if (!resposta.ok || dados?.status === "erro" || dados?.status === "indisponivel") {
    const mensagem = [dados?.erro, dados?.mensagem].filter(Boolean).join(" ");
    const erro = new Error(mensagem || "Não foi possível buscar o resultado oficial.");
    erro.tipo = dados?.tipo || "erro_api";
    erro.dados = dados;
    throw erro;
  }

  if (!Array.isArray(dados?.dezenas) || dados.dezenas.length !== 15) {
    throw new Error("O resultado recebido não contém 15 dezenas válidas.");
  }

  return dados;
}
