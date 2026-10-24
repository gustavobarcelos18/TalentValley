"use client";

import { useId, type FormEventHandler, type ReactNode } from "react";
import { Alert, Box, Button, Card, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Pagination, Skeleton, Stack, Typography } from "@mui/material";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { brandWash } from "@/components/common/surfaceGradient";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { Reveal } from "@/components/common/Reveal";
import { RpvShine, rpvHighlightSx } from "@/components/recruiter/RpvHighlight";
import type { PaginatedResponse } from "@/types/admin";

export function Page({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <PageHeader title={title} description={description} action={action} />
        {children}
      </Stack>
    </Container>
  );
}

export function LoadState({
  loading,
  error,
  reload,
  skeleton = "list",
  count = 3,
}: {
  loading: boolean;
  error: string | null;
  reload: () => void;
  skeleton?: "list" | "stats" | "cards";
  count?: number;
}) {
  if (loading) return <LoadingSkeleton variant={skeleton} count={count} />;
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={reload}>
            Tentar novamente
          </Button>
        }
      >
        {error}
      </Alert>
    );
  return null;
}

/** Row of an admin list: bordered card with a soft entrance, staggered by position. */
export function AdminRow({ index = 0, rpvVerified = false, children }: { index?: number; rpvVerified?: boolean; children: ReactNode }) {
  return (
    <Reveal index={index}>
      <Card sx={(theme) => ({ p: { xs: 2, sm: 2.5 }, minWidth: 0, ...(rpvVerified && rpvHighlightSx(theme)) })}>
        {rpvVerified && <RpvShine />}
        {children}
      </Card>
    </Reveal>
  );
}

/** Tinted square that holds a decorative icon at the start of a list row. */
export function IconTile({ children, size = 48 }: { children: ReactNode; size?: number }) {
  return (
    <Box
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
      sx={(theme) => {
        const { vivid } = (theme.vars ?? theme).palette;
        return {
          width: size,
          height: size,
          borderRadius: 3,
          color: vivid.contrastText,
          backgroundColor: vivid.main,
        };
      }}
    >
      {children}
    </Box>
  );
}

/** Text fields placed over the brand wash keep a solid background. */
export const fieldOnWash = { "& .MuiInputBase-root": { bgcolor: "background.paper" } };

/** Search block of an admin list: brand-washed card with the filters and the "Buscar" button. */
export function SearchCard({
  onSubmit,
  breakpoint = "sm",
  children,
}: {
  onSubmit: FormEventHandler<HTMLFormElement>;
  breakpoint?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <Reveal index={1}>
      <Card
        component="form"
        onSubmit={onSubmit}
        sx={(theme) => ({ p: { xs: 2, sm: 2.5 }, backgroundImage: brandWash(theme) })}
      >
        <Stack
          direction={{ xs: "column", [breakpoint]: "row" }}
          spacing={1.5}
          sx={{ alignItems: { [breakpoint]: "flex-start" } }}
        >
          {children}
          <Button type="submit" variant="contained" size="large" startIcon={<SearchOutlined />} sx={{ flexShrink: 0, minHeight: 56 }}>
            Buscar
          </Button>
        </Stack>
      </Card>
    </Reveal>
  );
}

/** Placeholder lines shown inside a detail dialog while the item loads. */
export function DetailSkeleton({ lastHeight = 48 }: { lastHeight?: number }) {
  return (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      <Skeleton variant="text" sx={{ fontSize: "1.5rem" }} />
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="text" width="50%" />
      <Skeleton variant="rounded" height={lastHeight} />
    </Stack>
  );
}

export function Status({ active }: { active: boolean }) {
  return (
    <Chip
      size="small"
      color={active ? "success" : "default"}
      label={active ? "Ativo" : "Bloqueado"}
    />
  );
}

export function Pager({
  data,
  setPage,
}: {
  data: PaginatedResponse<unknown>;
  setPage: (page: number) => void;
}) {
  return data.totalPages > 1 ? (
    <div className="flex justify-center">
      <Pagination
        page={data.page}
        count={data.totalPages}
        onChange={(_, p) => setPage(p)}
      />
    </div>
  ) : null;
}

export function Confirm({
  open,
  title,
  text,
  confirm,
  busy,
  onClose,
  danger = false,
  error = null,
}: {
  open: boolean;
  title: string;
  text: string;
  confirm: () => void;
  busy: boolean;
  onClose: () => void;
  danger?: boolean;
  error?: string | null;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}
        <Typography>{text}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color={danger ? "error" : "primary"}
          onClick={confirm}
          disabled={busy}
        >
          {busy ? "Processando..." : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
