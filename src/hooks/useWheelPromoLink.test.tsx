// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWheelPromoLink } from "./useWheelPromoLink";
import { balanceApi } from "../api/balance";

vi.mock("../api/balance", () => ({
  balanceApi: { activatePromocode: vi.fn() },
}));
const activate = vi.mocked(balanceApi.activatePromocode);

function setup(path: string) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  const view = renderHook(
    () => ({ notice: useWheelPromoLink(), location: useLocation() }),
    {
      wrapper,
    },
  );
  return { ...view, invalidate };
}

const refusal = (code: string) => ({
  response: { data: { detail: { code } } },
});

describe("useWheelPromoLink", () => {
  // В фигурных скобках: функцию из beforeEach vitest вызвал бы как очистку после теста.
  beforeEach(() => {
    activate.mockReset();
  });
  afterEach(cleanup);

  it("без параметра ничего не применяет", () => {
    setup("/wheel");
    expect(activate).not.toHaveBeenCalled();
  });

  it("применяет код один раз, обновляет колесо и убирает параметр", async () => {
    activate.mockResolvedValue({ success: true });
    const { result, invalidate } = setup("/wheel?promo=SPIN");

    await waitFor(() => expect(result.current.location.search).toBe(""));
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith("SPIN");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["wheel-config"] });
    expect(result.current.notice).toBeNull();
  });

  it.each([
    ["paid_subscription_required", "paid"],
    ["already_used_by_user", "alreadyUsed"],
    ["used", "ended"],
    ["expired", "ended"],
    ["server_error", "failed"],
  ])("отказ %s показывает «%s»", async (code, notice) => {
    activate.mockRejectedValue(refusal(code));
    const { result } = setup("/wheel?promo=SPIN");

    await waitFor(() => expect(result.current.notice).toBe(notice));
    expect(result.current.location.search).toBe("");
  });
});
