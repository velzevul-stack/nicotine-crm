import { getDataSource } from '@/lib/db/data-source';
import { DebtEntity, DebtOperationEntity } from '@/lib/db/entities';
import type { Debt } from '@/lib/db/entities/Debt';
import type { DebtOperation } from '@/lib/db/entities/DebtOperation';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';
import { In, MoreThan } from 'typeorm';
import { debtPaymentSchema } from '@/services/debts/debts.validators';

export async function listDebtsWithOperations(context: ShopContext) {
  const ds = await getDataSource();
  const debtRepo = ds.getRepository(DebtEntity);
  const opRepo = ds.getRepository(DebtOperationEntity);

  const debts = await debtRepo.find({
    where: { shopId: context.shopId, totalDebt: MoreThan(0) },
    order: { updatedAt: 'DESC' },
  });

  const debtIds = debts.map((d) => d.id);
  const allOps =
    debtIds.length > 0
      ? await opRepo.find({
          where: { debtId: In(debtIds) },
          order: { datetime: 'DESC' },
        })
      : [];

  const opsByDebtId = new Map<string, typeof allOps>();
  for (const op of allOps) {
    const list = opsByDebtId.get(op.debtId) ?? [];
    list.push(op);
    opsByDebtId.set(op.debtId, list);
  }

  return debts.map((d) => ({
    ...d,
    operations: opsByDebtId.get(d.id) ?? [],
  }));
}

export type DebtPaymentResult =
  | { removed: true }
  | { debt: Debt; operation: DebtOperation };

export async function recordDebtPayment(context: ShopContext, body: unknown): Promise<DebtPaymentResult> {
  const parsed = debtPaymentSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const debtRepo = em.getRepository(DebtEntity);
    const opRepo = em.getRepository(DebtOperationEntity);

    const debt = await debtRepo.findOne({
      where: { id: parsed.data.debtId, shopId: context.shopId },
    });
    if (!debt) {
      throw new NotFoundError('Debt not found');
    }

    const paymentAmount = Math.abs(parsed.data.amount);

    if (paymentAmount > debt.totalDebt) {
      throw new ValidationError(
        `Сумма оплаты (${paymentAmount}) не может быть больше остатка долга (${debt.totalDebt})`,
        undefined,
        { code: 'PAYMENT_EXCEEDS_DEBT' },
      );
    }

    const newTotal = Math.max(0, debt.totalDebt - paymentAmount);
    const fullyRepaid = newTotal < 1e-6;

    if (fullyRepaid) {
      await opRepo.delete({ debtId: debt.id });
      await debtRepo.delete({ id: debt.id });
      return { removed: true as const };
    }

    debt.totalDebt = newTotal;
    await debtRepo.save(debt);

    const op = opRepo.create({
      debtId: debt.id,
      saleId: null,
      amount: -paymentAmount,
      datetime: new Date(),
      comment: parsed.data.comment ?? 'Погашение долга',
    });
    await opRepo.save(op);

    return { debt, operation: op };
  });
}
