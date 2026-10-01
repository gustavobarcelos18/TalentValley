"use client";

import Link from "next/link";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { Box, Button, Container, Divider, Stack, Typography } from "@mui/material";

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

// Static legal document layout shared by /privacidade and /termos.
// Public and server-rendered: no authentication or auth redirects.
export function LegalDocument({
  title,
  effective,
  sections,
  lastUpdated,
}: {
  title: string;
  effective: string;
  sections: LegalSection[];
  lastUpdated: string;
}) {
  return (
    <Box component="main" sx={{ bgcolor: "background.default", minHeight: "100dvh" }}>
      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 6 } }}>
        <Stack spacing={3}>
          <Button
            component={Link}
            href="/"
            startIcon={<ArrowBackOutlined />}
            sx={{ alignSelf: "flex-start" }}
          >
            Página inicial
          </Button>
          <Typography component="h1" variant="h4">
            {title}
          </Typography>
          <Typography color="text.secondary">
            <strong>Efetiva a partir de:</strong> {effective}
          </Typography>
          {sections.map((section) => (
            <Stack key={section.title} component="section" spacing={1}>
              <Typography component="h2" variant="h6">
                {section.title}
              </Typography>
              {section.paragraphs.map((text) => (
                <Typography key={text} color="text.secondary">
                  {text}
                </Typography>
              ))}
            </Stack>
          ))}
          <Divider />
          <Typography variant="caption" color="text.secondary">
            Última atualização: {lastUpdated}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
