/** Read-only operations scoped to a shop (e.g. inventory snapshot, reports). */
export type ShopContext = {
  shopId: string;
  /** Для логов / трассировки (опционально). */
  requestId?: string;
  /** «Текущий момент» для тестируемой бизнес-логики (опционально). */
  now?: Date;
};

/** Mutations and user-scoped operations (sales, debts, etc.). */
export type ServiceContext = ShopContext & { userId: string };
