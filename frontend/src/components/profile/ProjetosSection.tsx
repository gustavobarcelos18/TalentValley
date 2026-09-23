"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { formatDateInput, parseDateInput } from "@/lib/format";
import { stripEmoji, validateBrazilianDateInput, validateFreeText, validateHttpUrl, validateProjectName } from "@/lib/validation";
import { createProjeto, deleteProjeto, fetchCompetenciaCatalog, fetchProjetos, updateProjeto } from "@/lib/student";
import type { CatalogoCompetenciaResponse, ProjetoRequest, ProjetoResponse } from "@/types/student";
import { FormDialog } from "./FormDialog";
import type { SectionProps } from "./sectionProps";

function maskProjectDate(value: string) { const digits = value.replace(/\D/g, "").slice(0, 8); return digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits; }

export function ProjetosSection({ onChanged, notify }: SectionProps) {
  const [projects, setProjects] = useState<ProjetoResponse[] | null>(null); const [error, setError] = useState<string | null>(null); const [editor, setEditor] = useState<ProjetoResponse | "new" | null>(null); const [deleting, setDeleting] = useState<ProjetoResponse | null>(null);
  const refresh = async () => { try { setProjects(await fetchProjetos()); setError(null); } catch { setError("Não foi possível carregar os projetos."); } };
  useEffect(() => {
    void fetchProjetos()
      .then((nextProjects) => { setProjects(nextProjects); setError(null); })
      .catch(() => setError("Não foi possível carregar os projetos."));
  }, []);
  const changed = async (message: string) => { await refresh(); await onChanged(); notify(message); };
  const sorted = [...(projects ?? [])].sort((a, b) => a.ordem - b.ordem);
  return <Paper component="section" elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, border: 1, borderColor: "divider" }}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}><BoxTitle /><Button size="small" startIcon={<AddOutlined />} onClick={() => setEditor("new")} disabled={projects === null || projects.length >= 2}>Adicionar projeto</Button></Stack>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}<Stack spacing={2} sx={{ mt: 2 }}>{projects !== null && projects.length === 0 && <Typography color="text.secondary">Mostre até dois projetos que melhor representam seu trabalho.</Typography>}{sorted.map((project) => <ProjectCard key={project.id} project={project} onEdit={() => setEditor(project)} onDelete={() => setDeleting(project)} />)}</Stack>{editor !== null && <ProjectForm project={editor === "new" ? undefined : editor} occupied={sorted.map((p) => p.ordem)} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void changed(editor === "new" ? "Projeto adicionado." : "Projeto atualizado."); }} />}<ProjectDelete project={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); void changed("Projeto removido."); }} /></Paper>;
}
function BoxTitle() { return <Stack><Typography component="h2" variant="h6">Projetos em destaque</Typography><Typography variant="body2" color="text.secondary">Selecione até dois projetos.</Typography></Stack>; }
function ProjectCard({ project, onEdit, onDelete }: { project: ProjetoResponse; onEdit: () => void; onDelete: () => void }) { return <Stack spacing={1} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}><Stack><Typography variant="overline">Projeto em destaque {project.ordem}</Typography><Typography sx={{ fontWeight: 700 }}>{project.nome}</Typography></Stack><Stack direction="row"><IconButton aria-label={`Editar ${project.nome}`} onClick={onEdit}><EditOutlined /></IconButton><IconButton color="error" aria-label={`Excluir ${project.nome}`} onClick={onDelete}><DeleteOutlined /></IconButton></Stack></Stack><Typography variant="body2">{project.descricao}</Typography><Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{project.competencias.map((item) => <Chip key={item.id} label={item.nome} size="small" />)}</Stack><Stack direction="row" spacing={1}>{project.demoUrl && <Button size="small" component="a" href={project.demoUrl} target="_blank" rel="noreferrer" endIcon={<OpenInNewOutlined />}>Demo</Button>}{project.repositorioUrl && <Button size="small" component="a" href={project.repositorioUrl} target="_blank" rel="noreferrer" endIcon={<OpenInNewOutlined />}>Repositório</Button>}</Stack></Stack>; }
function ProjectForm({ project, occupied, onClose, onSaved }: { project?: ProjetoResponse; occupied: number[]; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<ProjetoRequest>(project ? { ordem: project.ordem, nome: project.nome, dataInicio: formatDateInput(project.dataInicio), dataFim: formatDateInput(project.dataFim), emAndamento: project.emAndamento, descricao: project.descricao, demoUrl: project.demoUrl, repositorioUrl: project.repositorioUrl, competenciaIds: project.competencias.map((item) => item.id) } : { ordem: occupied.includes(1) ? 2 : 1, nome: "", dataInicio: "", dataFim: null, emAndamento: false, descricao: "", demoUrl: null, repositorioUrl: null, competenciaIds: [] });
  const [catalog, setCatalog] = useState<CatalogoCompetenciaResponse[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { fetchCompetenciaCatalog().then(setCatalog).catch(() => setCatalogError(true)); }, []);
  const set = <K extends keyof ProjetoRequest,>(key: K, value: ProjetoRequest[K]) => setData((p) => ({ ...p, [key]: value }));
  const setDate = (key: "dataInicio" | "dataFim", value: string) => { const masked = maskProjectDate(value); set(key, (masked || (key === "dataInicio" ? "" : null)) as ProjetoRequest[typeof key]); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nome = data.nome.trim();
    const descricao = data.descricao.trim();
    const demoUrl = data.demoUrl?.trim() || null;
    const repositorioUrl = data.repositorioUrl?.trim() || null;
    const dataInicio = parseDateInput(data.dataInicio);
    const dataFim = data.dataFim ? parseDateInput(data.dataFim) : null;
    if (validateProjectName(nome) || validateBrazilianDateInput(data.dataInicio) || !dataInicio || (!data.emAndamento && data.dataFim && (!dataFim || validateBrazilianDateInput(data.dataFim))) || validateFreeText(descricao, 1000) || !descricao || (dataFim && dataFim < dataInicio) || validateHttpUrl(demoUrl) || validateHttpUrl(repositorioUrl) || data.competenciaIds.some((id, index) => data.competenciaIds.indexOf(id) !== index)) {
      setError("Revise nome, datas, descrição, tecnologias e links. Os links devem começar com http:// ou https://.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const request = { ...data, nome, descricao, demoUrl, repositorioUrl, dataInicio, dataFim: data.emAndamento ? null : dataFim };
      if (project) await updateProjeto(project.id, request);
      else await createProjeto(request);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? "Você já possui dois projetos em destaque." : getApiErrorMessage(e, "Não foi possível salvar o projeto."));
    } finally {
      setSaving(false);
    }
  };
  const selected = catalog.filter((item) => data.competenciaIds.includes(item.id));
  const demoUrlInvalid = Boolean(data.demoUrl?.trim()) && Boolean(validateHttpUrl(data.demoUrl));
  const repositorioUrlInvalid = Boolean(data.repositorioUrl?.trim()) && Boolean(validateHttpUrl(data.repositorioUrl));
  return <FormDialog title={project ? "Editar projeto" : "Adicionar projeto"} onClose={onClose} onSubmit={submit} saving={saving} error={error}><Stack spacing={2}>
    {catalogError && <Alert severity="warning">Não foi possível carregar o catálogo de tecnologias.</Alert>}
    <TextField required label="Nome" value={data.nome} onChange={(e) => set("nome", e.target.value.slice(0, 200))} error={Boolean(data.nome && validateProjectName(data.nome))} helperText={validateProjectName(data.nome) ?? `${data.nome.length}/200`} slotProps={{ htmlInput: { maxLength: 200 } }} />
    <TextField select label="Posição" value={data.ordem} onChange={(e) => set("ordem", Number(e.target.value))}><MenuItem value={1}>Destaque 1</MenuItem><MenuItem value={2}>Destaque 2</MenuItem></TextField>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField required type="text" label="Início" value={data.dataInicio ?? ""} onChange={(e) => setDate("dataInicio", e.target.value)} placeholder="dd/mm/aaaa" slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }} />
      <TextField disabled={data.emAndamento} type="text" label="Término" value={data.dataFim ?? ""} onChange={(e) => setDate("dataFim", e.target.value)} placeholder="dd/mm/aaaa" slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }} />
    </Stack>
    <FormControlLabel control={<Switch checked={data.emAndamento} onChange={(e) => setData((p) => ({ ...p, emAndamento: e.target.checked, dataFim: e.target.checked ? null : p.dataFim }))} />} label="Projeto em andamento" />
    <TextField required multiline minRows={4} label="Descrição" value={data.descricao} onChange={(e) => set("descricao", stripEmoji(e.target.value).slice(0, 1000))} error={Boolean(data.descricao && validateFreeText(data.descricao, 1000))} helperText={validateFreeText(data.descricao, 1000) ?? `${data.descricao.length}/1000`} slotProps={{ htmlInput: { maxLength: 1000 } }} />
    <TextField label="Link da demo" type="url" value={data.demoUrl ?? ""} onChange={(e) => set("demoUrl", e.target.value.slice(0, 2048) || null)} error={demoUrlInvalid} helperText={demoUrlInvalid ? "Informe um link completo começando com http:// ou https://." : "Opcional. Use um endereço HTTP ou HTTPS."} slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url" } }} />
    <TextField label="Link do repositório" type="url" value={data.repositorioUrl ?? ""} onChange={(e) => set("repositorioUrl", e.target.value.slice(0, 2048) || null)} error={repositorioUrlInvalid} helperText={repositorioUrlInvalid ? "Informe um link completo começando com http:// ou https://." : "Opcional. Use um endereço HTTP ou HTTPS."} slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url" } }} />
    <Autocomplete multiple options={catalog} value={selected} onChange={(_, value) => set("competenciaIds", value.map((item) => item.id))} getOptionLabel={(item) => item.nome} isOptionEqualToValue={(a, b) => a.id === b.id} renderInput={(params) => <TextField {...params} label="Tecnologias" placeholder="Buscar tecnologia" />} />
  </Stack></FormDialog>;
}
function ProjectDelete({ project, onClose, onDeleted }: { project: ProjetoResponse | null; onClose: () => void; onDeleted: () => void }) { const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const remove = async () => { if (!project) return; setSaving(true); try { await deleteProjeto(project.id); onDeleted(); } catch (e) { setError(getApiErrorMessage(e, "Não foi possível remover o projeto.")); } finally { setSaving(false); } }; return <Dialog open={project !== null} onClose={onClose} aria-labelledby="delete-project-title"><DialogTitle id="delete-project-title">Excluir projeto?</DialogTitle><DialogContent>{error && <Alert severity="error">{error}</Alert>}<Typography>Você removerá “{project?.nome}”.</Typography></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Cancelar</Button><Button color="error" variant="contained" onClick={() => void remove()} disabled={saving}>Excluir</Button></DialogActions></Dialog>; }
