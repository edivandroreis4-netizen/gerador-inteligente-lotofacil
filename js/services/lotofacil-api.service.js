export async function buscarResultadoLotofacil(concurso = "") {
  const parametro = concurso ? `?concurso=${encodeURIComponent(concurso)}` : "";
  let resposta;
  try {
    resposta = await fetch(`/api/lotofacil${parametro}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
  } catch {
    throw new Error("Não foi possível acessar o servidor. Teste pela URL publicada na Vercel.");
  }

  const tipo = resposta.headers.get("content-type") || "";
  if (!tipo.includes("application/json")) {
    throw new Error("O servidor não retornou JSON. A API funciona na implantação da Vercel, não apenas no Live Server.");
  }

  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || "Não foi possível buscar o resultado oficial.");

  if (dados?.tipo === "proximo_concurso") {
    return dados;
  }

  if (!Array.isArray(dados.dezenas) || dados.dezenas.length !== 15) {
    throw new Error("O resultado recebido não contém 15 dezenas válidas.");
  }

  return dados;
}
