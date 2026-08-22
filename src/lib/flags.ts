// Pix processado pelo Asaas com split para a conta do organizador.
//
// DESLIGADO (stand-by). Aqui some o botão de compra e o toggle no CreateEvent,
// mas isso é só a interface: quem realmente recusa cobrança nova é a function
// `criarCobrancaPix`, controlada pela env PIX_ENABLED das functions. Os dois
// precisam ser desligados juntos — só esta constante deixaria o endpoint aberto
// para quem chamasse direto.
//
// O webhook continua ativo de propósito: cobranças geradas antes do stand-by
// ainda podem ser pagas, e quem pagou precisa receber o ingresso.
export const PIX_ENABLED = false;
