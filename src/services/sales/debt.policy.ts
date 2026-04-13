/** Суммы операций по долгу, сгруппированные по `debtId` (для отката перед пересозданием). */
export function sumDebtOperationAmountsByDebtId(
  operations: ReadonlyArray<{ debtId: string; amount: number }>,
): Map<string, number> {
  const byDebtId = new Map<string, number>();
  for (const op of operations) {
    byDebtId.set(op.debtId, (byDebtId.get(op.debtId) ?? 0) + op.amount);
  }
  return byDebtId;
}
