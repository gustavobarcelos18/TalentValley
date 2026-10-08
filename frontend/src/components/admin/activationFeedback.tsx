"use client";

import { useCallback, useState } from "react";
import { Alert, Button, Snackbar } from "@mui/material";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";

export type ActivationNotice = {
  message: string;
  severity: "success" | "info" | "warning" | "error";
  resendId: string | null;
};

export function useActivationFeedback() {
  const [notice, setNotice] = useState<ActivationNotice | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  const reportCreated = useCallback(
    (userId: string, activationSent: boolean, successMessage: string) => {
      setNotice(
        activationSent
          ? { message: successMessage, severity: "success", resendId: null }
          : {
              message:
                "Conta criada, mas não foi possível enviar o email de ativação.",
              severity: "warning",
              resendId: userId,
            },
      );
    },
    [],
  );

  const resend = useCallback(async () => {
    if (!notice?.resendId || resendBusy) return;
    setResendBusy(true);
    try {
      await adminApi.resendActivation(notice.resendId);
      setNotice({
        message: "Email de ativação reenviado.",
        severity: "success",
        resendId: null,
      });
    } catch (cause) {
      const status = (cause as { status?: number })?.status;
      if (status === 409) {
        setNotice({
          message: "A conta já foi ativada.",
          severity: "info",
          resendId: null,
        });
      } else if (status === 404) {
        setNotice({
          message: "Usuário não encontrado.",
          severity: "error",
          resendId: null,
        });
      } else if (status === 503) {
        setNotice({
          message: "O envio ainda está indisponível. Tente novamente mais tarde.",
          severity: "warning",
          resendId: notice.resendId,
        });
      } else {
        setNotice({
          message: getApiErrorMessage(
            cause,
            "Não foi possível reenviar a ativação.",
          ),
          severity: "error",
          resendId: null,
        });
      }
    } finally {
      setResendBusy(false);
    }
  }, [notice, resendBusy]);

  return { notice, setNotice, reportCreated, resend, resendBusy };
}

export function ActivationSnackbar({
  notice,
  busy,
  onClose,
  onResend,
}: {
  notice: ActivationNotice | null;
  busy: boolean;
  onClose: () => void;
  onResend: () => void;
}) {
  return (
    <Snackbar
      open={!!notice}
      autoHideDuration={notice?.resendId ? null : 5000}
      onClose={onClose}
    >
      <Alert
        severity={notice?.severity ?? "info"}
        action={
          notice?.resendId ? (
            <Button color="inherit" size="small" disabled={busy} onClick={onResend}>
              {busy ? "Reenviando..." : "Reenviar ativação"}
            </Button>
          ) : undefined
        }
      >
        {notice?.message}
      </Alert>
    </Snackbar>
  );
}
