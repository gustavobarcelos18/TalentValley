"use client";

import type { ReactNode } from "react";
import { Box, Button, IconButton, Typography } from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { EmptyState } from "@/components/common/EmptyState";
import { SurfaceCard } from "@/components/common/SurfaceCard";

interface SectionCardProps {
  title: string;
  /** One short line under the title: what the section is for and who it matters to. */
  help?: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** One line under the empty title, saying what to put here. */
  emptyDescription?: string;
  emptyActionLabel?: string;
  /** Material icon shown above the empty message. */
  emptyIcon?: ReactNode;
}

// Profile section card: title, accessible edit action, content or a friendly
// empty state. Sections edit through focused MUI dialogs, never inline.
export function SectionCard({
  title,
  help,
  editLabel,
  onEdit,
  children,
  isEmpty = false,
  emptyMessage,
  emptyDescription,
  emptyActionLabel,
  emptyIcon,
}: SectionCardProps) {
  const emptyAction = emptyActionLabel ? (
    <Button variant="outlined" size="small" onClick={onEdit}>
      {emptyActionLabel}
    </Button>
  ) : undefined;

  return (
    <SurfaceCard
      title={title}
      action={
        <IconButton
          size="small"
          aria-label={editLabel}
          onClick={onEdit}
          sx={{ color: "primary.main" }}
        >
          <EditOutlined fontSize="small" />
        </IconButton>
      }
    >
      {help && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {help}
        </Typography>
      )}
      {isEmpty && emptyMessage && (
        <EmptyState icon={emptyIcon} title={emptyMessage} description={emptyDescription} action={emptyAction} />
      )}
      {isEmpty && !emptyMessage && emptyAction}
      <Box sx={isEmpty ? { display: "none" } : undefined}>{children}</Box>
    </SurfaceCard>
  );
}
