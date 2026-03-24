import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { DebtEntity, DebtOperationEntity } from '@/lib/db/entities';
import { In, MoreThan } from 'typeorm';
import { z } from 'zod';

const paymentSchema = z.object({
  debtId: z.string().uuid(),
  amount: z.number().positive(),
  comment: z.string().nullable().default(null),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  
  const debtRepo = ds.getRepository(DebtEntity);
  const opRepo = ds.getRepository(DebtOperationEntity);
  
  // Только ненулевой остаток — после полного погашения запись не показываем в списке
  const debts = await debtRepo.find({
    where: { shopId: session.shopId, totalDebt: MoreThan(0) },
    order: { updatedAt: 'DESC' },
  });

  // Используем транзакцию для избежания предупреждения о параллельных запросах
  const withOps = await ds.transaction(async (em) => {
    const debtIds = debts.map(d => d.id);
    
    // Получаем все операции одним запросом для всех долгов
    const allOps = debtIds.length > 0 
      ? await em.getRepository(DebtOperationEntity).find({
          where: { debtId: In(debtIds) },
          order: { datetime: 'DESC' },
        })
      : [];
    
    // Группируем операции по debtId
    const opsByDebtId = new Map<string, typeof allOps>();
    for (const op of allOps) {
      const list = opsByDebtId.get(op.debtId) ?? [];
      list.push(op);
      opsByDebtId.set(op.debtId, list);
    }
    // Объединяем долги с их операциями
    return debts.map(d => ({
      ...d,
      operations: opsByDebtId.get(d.id) ?? [],
    }));
  });

  return NextResponse.json(withOps);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();

  return ds.transaction(async (em) => {
    const debtRepo = em.getRepository(DebtEntity);
    const opRepo = em.getRepository(DebtOperationEntity);

    const debt = await debtRepo.findOne({
      where: { id: parsed.data.debtId, shopId: session.shopId },
    });
    if (!debt) {
      return NextResponse.json({ message: 'Debt not found' }, { status: 404 });
    }

    const paymentAmount = Math.abs(parsed.data.amount);

    if (paymentAmount > debt.totalDebt) {
      return NextResponse.json(
        { message: `Сумма оплаты (${paymentAmount}) не может быть больше остатка долга (${debt.totalDebt})` },
        { status: 400 }
      );
    }

    const newTotal = Math.max(0, debt.totalDebt - paymentAmount);
    const fullyRepaid = newTotal < 1e-6;

    if (fullyRepaid) {
      await opRepo.delete({ debtId: debt.id });
      await debtRepo.delete({ id: debt.id });
      return NextResponse.json({ removed: true });
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

    return NextResponse.json({ debt, operation: op });
  });
}
