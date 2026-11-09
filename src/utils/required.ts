/**
 * Значение, наличие которого уже обеспечено вызывающим кодом (`enabled` у запроса,
 * проверка перед отправкой). Если обещание нарушено, падает с понятной ошибкой,
 * а не отправляет `undefined` дальше.
 */
export function required<T>(value: T | null | undefined, name = 'value'): T {
  if (value === null || value === undefined) {
    throw new Error(`Missing required ${name}`);
  }
  return value;
}
