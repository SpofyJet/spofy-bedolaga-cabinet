/**
 * Состояние подвала карточки подписки — «подключить устройство».
 *
 * Вынесено из компонента отдельно, потому что правил тут больше, чем кажется:
 * безлимит и исчерпанный лимит выражаются одним и тем же полем `device_limit`,
 * а незагруженный счётчик нельзя путать с нулём подключённых устройств.
 */

export type ConnectFooterState =
  /** Нет ссылки на подписку — показывать вход некуда. */
  | { kind: 'hidden' }
  /** Счётчик устройств ещё не пришёл — показываем скелетон, а не догадку. */
  | { kind: 'loading' }
  /** Есть куда подключаться. `highlight` — ни одного устройства, зовём заметнее. */
  | { kind: 'connect'; used: number; limit: number; unlimited: boolean; highlight: boolean }
  /** Слоты кончились — ведём разбираться, а не блокируем. */
  | { kind: 'full'; used: number; limit: number };

/** Ссылка полезна при живом доступе и после его окончания. */
const LINK_STATUSES = new Set(['active', 'trial', 'limited', 'expired', 'disabled']);
const INACTIVE_STATUSES = new Set(['expired', 'disabled']);

export interface ConnectFooterInput {
  status: string;
  /** Ссылка на подписку из панели: без неё подключать не к чему. */
  subscriptionUrl: string | null | undefined;
  /** 0 означает «без лимита устройств», а не «нельзя ни одного». */
  deviceLimit: number;
  /** `undefined`, пока запрос числа устройств не завершился. */
  connected: number | undefined;
}

export function connectFooterState({
  status,
  subscriptionUrl,
  deviceLimit,
  connected,
}: ConnectFooterInput): ConnectFooterState {
  if (!subscriptionUrl || !LINK_STATUSES.has(status)) {
    return { kind: 'hidden' };
  }

  if (connected === undefined) {
    return { kind: 'loading' };
  }

  const unlimited = deviceLimit === 0;

  // После окончания доступа лимит устройств не должен закрывать саб-страницу:
  // там можно купить доступ, а ссылку — добавить в приложение и увидеть статус.
  if (INACTIVE_STATUSES.has(status)) {
    return {
      kind: 'connect',
      used: connected,
      limit: deviceLimit,
      unlimited,
      highlight: false,
    };
  }

  // `>=`, а не `===`: лимит можно понизить ниже числа уже подключённых
  // устройств, и тогда слотов «минус один» — состояние всё равно полное.
  if (!unlimited && connected >= deviceLimit) {
    return { kind: 'full', used: connected, limit: deviceLimit };
  }

  return {
    kind: 'connect',
    used: connected,
    limit: deviceLimit,
    unlimited,
    highlight: connected === 0,
  };
}
