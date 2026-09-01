// Máscara de exibição de CPF. A validação de dígitos (isValidCPF) saiu junto
// com o fluxo Pix — voltar a buscar no histórico se a compra com CPF retornar.

// Formata progressivamente para exibição: 000.000.000-00 (aceita string parcial).
export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};
