export function alertaSucesso(titulo, texto) {
  Swal.fire({ icon: "success", title: titulo, text: texto, confirmButtonColor: "#16a34a" });
}

export function alertaErro(titulo, texto) {
  Swal.fire({ icon: "error", title: titulo, text: texto, confirmButtonColor: "#16a34a" });
}

export function alertaAcertos(total) {
  const mensagens = {
    11: ["Parabéns!", "Você acertou 11 números."],
    12: ["Excelente!", "Você acertou 12 números."],
    13: ["Ótimo resultado!", "Você acertou 13 números."],
    14: ["Quase lá!", "Você ficou a apenas 1 número do prêmio máximo."],
    15: ["Parabéns!", "Você acertou os 15 números da Lotofácil!"]
  };

  if (total >= 11) {
    const [titulo, texto] = mensagens[total];
    Swal.fire({ icon: "success", title: titulo, text: texto, confirmButtonColor: "#16a34a" });
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
