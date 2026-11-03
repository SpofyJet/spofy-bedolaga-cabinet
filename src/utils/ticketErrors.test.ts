import { readFileSync } from 'node:fs';
import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { isOpenTicketConflict } from './ticketErrors';

function axiosErrorWithStatus(status: number, detail?: unknown): AxiosError {
  const headers = new AxiosHeaders();
  const config = { headers };
  return new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    config,
    {},
    {
      status,
      statusText: '',
      headers,
      config,
      data: detail === undefined ? {} : { detail },
    },
  );
}

describe('isOpenTicketConflict', () => {
  it('ловит 409 от POST /cabinet/tickets', () => {
    expect(isOpenTicketConflict(axiosErrorWithStatus(409, 'You already have an open ticket'))).toBe(
      true,
    );
  });

  it('не зависит от текста detail (он приходит с бэка по-английски)', () => {
    expect(isOpenTicketConflict(axiosErrorWithStatus(409))).toBe(true);
    expect(isOpenTicketConflict(axiosErrorWithStatus(409, { code: 'open_ticket_exists' }))).toBe(
      true,
    );
  });

  it('не путает с другими отказами бэка', () => {
    expect(isOpenTicketConflict(axiosErrorWithStatus(403, 'Support tickets are disabled'))).toBe(
      false,
    );
    expect(isOpenTicketConflict(axiosErrorWithStatus(400))).toBe(false);
    expect(isOpenTicketConflict(axiosErrorWithStatus(500))).toBe(false);
  });

  it('не падает на не-axios ошибках', () => {
    expect(isOpenTicketConflict(new Error('boom'))).toBe(false);
    expect(isOpenTicketConflict(undefined)).toBe(false);
    expect(isOpenTicketConflict(null)).toBe(false);
  });
});

describe('обработчики ошибок в чате поддержки', () => {
  // Поведение (409 → сообщение уходит в уже открытое обращение) проверено
  // рендером в src/pages/supportChat.test.tsx. Здесь — структурная страховка:
  // отказ бэка не должен уходить в никуда, как было в старой тикет-форме.
  const source = readFileSync(new URL('../pages/Support.tsx', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('const sendMutation'), source.indexOf('const canSend'));

  it('отправка обрабатывает отказ бэка', () => {
    expect(block).toContain('onError');
    expect(block).toContain('setError');
  });

  it('409 не теряет сообщение — оно уходит в открытое обращение', () => {
    expect(block).toContain('isOpenTicketConflict(err)');
    expect(block).toContain('ticketsApi.addMessage(open.id');
  });

  it('после отправки переписка перечитывается', () => {
    expect(block).toContain('invalidateQueries');
  });
});
