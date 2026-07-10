export function alertaSucesso(titulo, texto) {
  Swal.fire({ icon: "success", title: titulo, text: texto, confirmButtonColor: "#16a34a" });
}

export function alertaErro(titulo, texto) {
  Swal.fire({ icon: "error", title: titulo, text: texto, confirmButtonColor: "#16a34a" });
}

export function alertaAcertos(total, valorPremioTexto = "") {
  const mensagens = {
    11: ["Aposta premiada!", "Você acertou 11 números."],
    12: ["Aposta premiada!", "Você acertou 12 números."],
    13: ["Aposta premiada!", "Você acertou 13 números."],
    14: ["Aposta premiada!", "Você acertou 14 números. Quase o prêmio máximo."],
    15: ["Prêmio máximo!", "Você acertou os 15 números da Lotofácil!"]
  };

  if (total >= 11) {
    const [titulo, texto] = mensagens[total];
    const complemento = valorPremioTexto ? ` Valor em prêmios: ${valorPremioTexto}.` : " Confira o valor no resultado da conferência.";
    Swal.fire({ icon: "success", title: titulo, text: `${texto}${complemento}`, confirmButtonColor: "#16a34a" });
    return;
  }

  Swal.fire({ icon: "info", title: `${total} acertos`, text: "Ainda não entrou na faixa de premiação. Continue analisando seus jogos.", confirmButtonColor: "#16a34a" });
}

export async function confirmarLimpeza() {
  const resposta = await Swal.fire({
    icon: "warning",
    title: "Limpar histórico?",
    text: "Essa ação vai apagar todos os jogos salvos neste navegador.",
    showCancelButton: true,
    confirmButtonText: "Sim, limpar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#ef4444"
  });

  return resposta.isConfirmed;
}

export async function confirmarExclusaoJogo() {
  const resposta = await Swal.fire({
    icon: "warning",
    title: "Excluir este jogo?",
    text: "Apenas este registro será removido do histórico.",
    showCancelButton: true,
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#ef4444"
  });

  return resposta.isConfirmed;
}
