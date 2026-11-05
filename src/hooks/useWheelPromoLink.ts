import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { balanceApi } from "../api/balance";

export type WheelPromoNotice = "paid" | "alreadyUsed" | "ended" | "failed";

function noticeFor(code: string | undefined): WheelPromoNotice {
  if (code === "paid_subscription_required") return "paid";
  if (code === "already_used_by_user") return "alreadyUsed";
  if (code === "used" || code === "expired" || code === "inactive")
    return "ended";
  return "failed";
}

/**
 * Ссылка из канала открывает колесо с ?promo=КОД: код применяется сам, вводить его
 * нигде не нужно. Параметр убираем сразу, чтобы обновление страницы не слало запрос снова.
 */
export function useWheelPromoLink(): WheelPromoNotice | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const handled = useRef(false);
  const [notice, setNotice] = useState<WheelPromoNotice | null>(null);
  const code = searchParams.get("promo");

  useEffect(() => {
    if (!code || handled.current) return;
    handled.current = true;

    balanceApi
      .activatePromocode(code)
      .then((result) => {
        if (!result.success) setNotice("failed");
      })
      .catch(
        (error: {
          response?: { data?: { detail?: { code?: string } | string } };
        }) => {
          const detail = error.response?.data?.detail;
          setNotice(
            noticeFor(
              typeof detail === "object" && detail ? detail.code : undefined,
            ),
          );
        },
      )
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: ["wheel-config"] });
        setSearchParams({}, { replace: true });
      });
  }, [code, queryClient, setSearchParams]);

  return notice;
}
