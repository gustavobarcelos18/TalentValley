"use client";

import type { ReactNode } from "react";
import { Box, Button, IconButton, Paper, Stack, Typography } from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";

interface SectionCardProps {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyActionLabel?: string;
}

// Profile section card: title, accessible edit action, content or a friendly
// empty state. Sections edit through focused MUI dialogs, never inline.
export function SectionCard({
  title,
  editLabel,
  onEdit,
  children,
  isEmpty = false,
  emptyMessage,
  emptyActionLabel,
}: SectionCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{ p: { xs: 2.5, sm: 3 }, border: 1, borderColor: "divider" }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography component="h2" variant="h6">
          {title}
        </Typography>
        <IconButton
          size="small"
          aria-label={editLabel}
          onClick={onEdit}
          sx={{ color: "primary.main" }}
        >
          <EditOutlined fontSize="small" />
        </IconButton>
      </Stack>
      <Box sx={{ mt: 2 }}>
        {isEmpty ? (
          <Stack spacing={1.5}>
            {emptyMessage && (
              <Typography variant="body2" color="text.secondary">
                {emptyMessage}
              </Typography>
            )}
            {emptyActionLabel && (
              <Button
                variant="outlined"
                size="small"
                onClick={onEdit}
                className="self-start"
              >
                {emptyActionLabel}
              </Button>
            )}
          </Stack>
        ) : (
          children
        )}
      </Box>
    </Paper>
  );
}
