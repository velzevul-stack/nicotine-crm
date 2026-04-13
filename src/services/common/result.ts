/** Успешное значение (discriminated union). */
export type Ok<T> = { ok: true; value: T };

/** Ошибка домена / валидации без исключения. */
export type Err<E = unknown> = { ok: false; error: E };

export type Result<T, E = unknown> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.ok === false;
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return isOk(r) ? r.value : fallback;
}
