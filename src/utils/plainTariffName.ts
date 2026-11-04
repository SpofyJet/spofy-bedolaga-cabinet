/**
 * Название тарифа без эмодзи: «👑 ULTIMA» → «ULTIMA», «Хит 🔥 месяц» → «Хит месяц».
 *
 * В боте эмодзи в названиях — часть оформления кнопок, а в кабинете рядом с
 * плоскими иконками и чипами они выглядят чужеродно. Страница подписки делает
 * то же самое (plainPlanName). ©, ® и ™ — не эмодзи, их не трогаем.
 *
 * Если от названия ничего не осталось (оно целиком из эмодзи), отдаём исходное:
 * пустой заголовок хуже, чем эмодзи.
 */
const EMOJI =
  /(?![©®™])\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]|\u{FE0E}|\u{FE0F}|\u{200D}|\u{20E3}/gu;

export function plainTariffName<T extends string | null | undefined>(name: T): T {
  if (!name) return name;
  const plain = name.replace(EMOJI, ' ').replace(/\s+/g, ' ').trim();
  return (plain || name.trim()) as T;
}
