"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { ApiError, apiDownload, getApiErrorMessage } from "@/lib/api";
import { formatDate, formatDateInput, maskDateInput, parseDateInput } from "@/lib/format";
import { sanitizeIntegerInput, stripEmoji, stripEmojiOnPaste, validateCompanyName, validateCourseName, validateDatePeriod, validateInstitutionName, validateJobTitle, validateWorkloadHours } from "@/lib/validation";
import { createExperiencia, createFormacao, deleteExperiencia, deleteFormacao, deleteFormationCertificate, fetchTrajectory, updateExperiencia, updateFormacao, uploadFormationCertificate } from "@/lib/student";
import type { ExperienciaRequest, ExperienciaResponse, FormacaoRequest, FormacaoResponse, StatusFormacao, TipoExperiencia, TipoFormacao, TrajetoriaItemResponse } from "@/types/student";
import { FormDialog, fieldError } from "./FormDialog";
import type { SectionProps } from "./sectionProps";

const formationLabels: Record<TipoFormacao, string> = { CURSO_LIVRE: "Curso livre", TECNICO: "Técnico", TECNOLOGO: "Tecnólogo", GRADUACAO: "Graduação", POS_GRADUACAO: "Pós-graduação" };
const formationStatus: Record<StatusFormacao, string> = { EM_ANDAMENTO: "Em andamento", CONCLUIDO: "Concluído", TRANCADO: "Trancado" };
const experienceLabels: Record<TipoExperiencia, string> = { PROFISSIONAL: "Profissional", ESTAGIO: "Estágio" };
const formatTrajectoryDate = (date: string | null) => date ? formatDate(date) : "Atual";
const sanitizeFormationText = (value: string) => stripEmoji(value).slice(0, 200);
const CERTIFICADO_MAX_BYTES = 10 * 1024 * 1024;

// Local PDF validation for formation certificates, mirroring the curriculum
// validation rules in CurriculoSection (extension, MIME, size, magic bytes).
async function validateCertificatePdf(file: File): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Envie um arquivo PDF.";
  }
  if (file.type && file.type !== "application/pdf") {
    return "O arquivo selecionado não é um PDF válido.";
  }
  if (file.size === 0) {
    return "O arquivo PDF está vazio.";
  }
  if (file.size > CERTIFICADO_MAX_BYTES) {
    return "O certificado deve ter no máximo 10 MB.";
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (signature.length !== 5 || new TextDecoder().decode(signature) !== "%PDF-") {
    return "O arquivo selecionado não é um PDF válido.";
  }
  return null;
}

export function TrajetoriaSection({ onChanged, notify }: SectionProps) {
  const [items, setItems] = useState<TrajetoriaItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ kind: "formation"; item?: FormacaoResponse } | { kind: "experience"; item?: ExperienciaResponse } | null>(null);
  const [removing, setRemoving] = useState<TrajetoriaItemResponse | null>(null);
  const refresh = async () => { try { setItems(await fetchTrajectory()); setError(null); } catch { setError("Não foi possível carregar sua trajetória."); } };
  useEffect(() => {
    void fetchTrajectory()
      .then((nextItems) => { setItems(nextItems); setError(null); })
      .catch(() => setError("Não foi possível carregar sua trajetória."));
  }, []);
  const changed = async (message: string) => { await refresh(); await onChanged(); notify(message); };
  const formations = (items ?? []).filter((item) => item.formacao);
  const experiences = (items ?? []).filter((item) => item.experiencia);
  const openEditor = (item: TrajetoriaItemResponse) =>
    setEditor(item.formacao ? { kind: "formation", item: item.formacao } : { kind: "experience", item: item.experiencia! });
  return <SurfaceCard title="Trajetória">
    <Typography variant="body2" color="text.secondary">Formações e experiências em ordem profissional.</Typography>
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {items === null && !error && <Box sx={{ mt: 2 }}><LoadingSkeleton count={2} height={110} /></Box>}{items !== null && <Stack spacing={4} sx={{ mt: 2 }}>
      <TrajectoryGroup title="Formação e certificados" icon={<SchoolOutlined />} emptyMessage="Adicione formações acadêmicas, cursos e certificados para destacar seu preparo." actionLabel="Adicionar formação" items={formations} onAdd={() => setEditor({ kind: "formation" })} onEdit={openEditor} onDelete={setRemoving} onChanged={changed} />
      <TrajectoryGroup title="Experiência" icon={<BusinessCenterOutlined />} emptyMessage="Adicione experiências profissionais ou estágios para mostrar sua trajetória." actionLabel="Adicionar experiência" items={experiences} onAdd={() => setEditor({ kind: "experience" })} onEdit={openEditor} onDelete={setRemoving} onChanged={changed} />
    </Stack>}
    {editor?.kind === "formation" ? <FormationForm item={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void changed(editor.item ? "Formação atualizada." : "Formação adicionada."); }} /> : editor?.kind === "experience" ? <ExperienceForm item={editor.item} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void changed(editor.item ? "Experiência atualizada." : "Experiência adicionada."); }} /> : null}
    <DeleteDialog item={removing} onClose={() => setRemoving(null)} onDeleted={() => { setRemoving(null); void changed("Item removido da trajetória."); }} />
  </SurfaceCard>;
}

function TrajectoryGroup({ title, icon, emptyMessage, actionLabel, items, onAdd, onEdit, onDelete, onChanged }: {
  title: string;
  icon: ReactNode;
  emptyMessage: string;
  actionLabel: string;
  items: TrajetoriaItemResponse[];
  onAdd: () => void;
  onEdit: (item: TrajetoriaItemResponse) => void;
  onDelete: (item: TrajetoriaItemResponse) => void;
  onChanged: (message: string) => Promise<void>;
}) {
  return <Box component="section">
    <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      {items.length > 0 && <Button size="small" startIcon={<AddOutlined />} onClick={onAdd}>{actionLabel}</Button>}
    </Stack>
    {items.length === 0 ? <Box sx={{ mt: 2 }}><EmptyState icon={icon} title={emptyMessage} action={<Button startIcon={<AddOutlined />} onClick={onAdd}>{actionLabel}</Button>} /></Box> : <Stack component="ol" role="list" spacing={3} sx={(theme) => ({
      listStyle: "none", m: 0, mt: 2, p: 0, position: "relative",
      "&::before": { content: "\"\"", position: "absolute", left: 17, top: 18, bottom: 18, width: 2, backgroundColor: (theme.vars ?? theme).palette.divider },
    })}>{items.map((item) => <TimelineItem key={`${item.tipoItem}-${item.id}`} item={item} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} onChanged={onChanged} />)}</Stack>}
  </Box>;
}

function TimelineItem({ item, onEdit, onDelete, onChanged }: { item: TrajetoriaItemResponse; onEdit: () => void; onDelete: () => void; onChanged: (message: string) => Promise<void> }) {
  const formation = item.formacao;
  return <Box component="li" sx={{ position: "relative", pl: 6.5 }}><Box aria-hidden="true" className="flex size-9 items-center justify-center" sx={(theme) => {
    const { primary, secondary, surface } = (theme.vars ?? theme).palette;
    const color = formation ? primary.main : secondary.main;
    return { position: "absolute", left: 0, top: 0, borderRadius: "50%", color, backgroundColor: surface.raised, border: 2, borderColor: color };
  }}>{formation ? <SchoolOutlined fontSize="small" /> : <BusinessCenterOutlined fontSize="small" />}</Box><Stack spacing={.75} sx={{ minWidth: 0 }}><Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography sx={{ fontWeight: 700 }}>{item.titulo}</Typography>{formation?.principal && <Chip label="Principal" size="small" color="primary" />}{formation && <RpvChip formation={formation} />}</Stack><Typography variant="body2" color="text.secondary">{item.subtitulo} · {formatTrajectoryDate(item.dataInicio)} — {item.atual ? "Atual" : formatTrajectoryDate(item.dataFim)}</Typography>{formation ? <FormationCertificate formation={formation} onChanged={onChanged} /> : item.experiencia?.descricao && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.experiencia.descricao}</Typography>}<Stack direction="row" spacing={.5}><IconButton size="small" aria-label={`Editar ${item.titulo}`} onClick={onEdit}><EditOutlined fontSize="small" /></IconButton><IconButton size="small" color="error" aria-label={`Excluir ${item.titulo}`} onClick={onDelete}><DeleteOutlined fontSize="small" /></IconButton></Stack></Stack></Box>;
}

function RpvChip({ formation }: { formation: FormacaoResponse }) { if (!formation.ehRioPombaValley) return null; const labels = { PENDENTE: "Aguardando validação", VERIFICADO: "Verificado pelo Rio Pomba Valley", REJEITADO: "Validação não aprovada" }; return <Chip size="small" variant="outlined" color={formation.statusValidacaoRpv === "VERIFICADO" ? "success" : formation.statusValidacaoRpv === "REJEITADO" ? "error" : "warning"} label={formation.statusValidacaoRpv ? labels[formation.statusValidacaoRpv] : "Aguardando validação"} />; }

function FormationCertificate({ formation, onChanged }: { formation: FormacaoResponse; onChanged: (message: string) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [confirmRemove, setConfirmRemove] = useState(false);
  const mutate = async (task: () => Promise<void>, success: string) => { setBusy(true); setError(null); try { await task(); await onChanged(success); } catch (e) { setError(getApiErrorMessage(e, "Não foi possível alterar o certificado.")); } finally { setBusy(false); } };
  const download = async () => { setBusy(true); try { const blob = await apiDownload(`/api/alunos/me/formacoes/${formation.id}/certificado`); const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer"); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { setError(getApiErrorMessage(e, "Não foi possível abrir o certificado.")); } finally { setBusy(false); } };
  const removeCertificate = async () => { try { await mutate(() => deleteFormationCertificate(formation.id), "Certificado removido."); } finally { setConfirmRemove(false); } };
  const pickFile = () => inputRef.current?.click();
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const validation = await validateCertificatePdf(file);
      if (validation) { setError(validation); return; }
      await uploadFormationCertificate(formation.id, file);
      await onChanged(formation.possuiCertificado ? "Certificado substituído." : "Certificado enviado.");
    } catch (e) {
      setError(getApiErrorMessage(e, "Não foi possível enviar o certificado. Tente novamente."));
    } finally { setBusy(false); }
  };
  return <Stack spacing={.5}>{formation.ehRioPombaValley && <Typography variant="caption" color="text.secondary">Alterações na formação ou no certificado podem exigir uma nova validação.</Typography>}{error && <Alert severity="error">{error}</Alert>}<Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{formation.possuiCertificado ? <><Button size="small" startIcon={<DownloadOutlined />} onClick={() => void download()} disabled={busy}>Abrir certificado</Button><Button size="small" startIcon={<UploadFileOutlined />} onClick={pickFile} disabled={busy}>Substituir certificado</Button><Button size="small" color="error" onClick={() => setConfirmRemove(true)} disabled={busy}>Remover</Button></> : <Button size="small" startIcon={<UploadFileOutlined />} onClick={pickFile} disabled={busy}>Enviar certificado</Button>}</Stack><input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden aria-label={`Selecionar certificado em PDF para ${formation.nome}`} onChange={(event) => void handleFileChange(event)} />
      <Dialog open={confirmRemove} onClose={() => { if (!busy) setConfirmRemove(false); }} aria-labelledby="remove-certificate-title">
        <DialogTitle id="remove-certificate-title">Remover certificado?</DialogTitle>
        <DialogContent><Typography>O certificado desta formação será removido. Você poderá enviar outro arquivo depois.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(false)} disabled={busy}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => void removeCertificate()} disabled={busy}>{busy ? "Removendo..." : "Remover certificado"}</Button>
        </DialogActions>
      </Dialog>
    </Stack>;
}

function FormationForm({ item, onClose, onSaved }: { item?: FormacaoResponse; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<FormacaoRequest>(item ? { tipo: item.tipo, nome: item.nome, instituicao: item.instituicao, dataInicio: formatDateInput(item.dataInicio), dataFim: formatDateInput(item.dataFim), cargaHoraria: item.cargaHoraria, status: item.status, principal: item.principal, ehRioPombaValley: item.ehRioPombaValley } : { tipo: "GRADUACAO", nome: "", instituicao: "", dataInicio: "", dataFim: null, cargaHoraria: null, status: "EM_ANDAMENTO", principal: false, ehRioPombaValley: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof FormacaoRequest,>(key: K, value: FormacaoRequest[K]) => setData((p) => ({ ...p, [key]: value }));
  const setDate = (key: "dataInicio" | "dataFim", value: string) => {
    const masked = maskDateInput(value);
    set(key, (masked || (key === "dataInicio" ? "" : null)) as FormacaoRequest[typeof key]);
  };
  const nome = data.nome.trim();
  const instituicao = data.instituicao.trim();
  const dates = validateDatePeriod(data.dataInicio, data.status === "EM_ANDAMENTO" ? null : data.dataFim, data.status === "CONCLUIDO" ? "Informe a data de conclusão." : null);
  const errors = { nome: validateCourseName(nome), instituicao: validateInstitutionName(instituicao), dataInicio: dates.start, dataFim: dates.end, cargaHoraria: validateWorkloadHours(data.cargaHoraria) };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setError(null);
    const dataInicio = parseDateInput(data.dataInicio);
    const dataFim = data.dataFim ? parseDateInput(data.dataFim) : null;
    if (Object.values(errors).some(Boolean) || !dataInicio) return;
    setSaving(true);
    setError(null);
    try {
      const request = { ...data, nome, instituicao, dataInicio, dataFim: data.status === "EM_ANDAMENTO" ? null : dataFim };
      if (item) await updateFormacao(item.id, request);
      else await createFormacao(request);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível salvar a formação."));
    } finally {
      setSaving(false);
    }
  };
  return <FormDialog title={item ? "Editar formação" : "Adicionar formação"} onClose={onClose} onSubmit={submit} saving={saving} error={error} focusFirstInvalid><Stack spacing={2}>
    <TextField select label="Tipo" value={data.tipo} onChange={(e) => set("tipo", e.target.value as TipoFormacao)}>{Object.entries(formationLabels).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>
    <TextField required label="Nome" value={data.nome} onChange={(e) => set("nome", sanitizeFormationText(e.target.value))} {...fieldError(errors.nome, attempted)} slotProps={{ htmlInput: { maxLength: 200, onPaste: stripEmojiOnPaste } }} />
    <TextField required label="Instituição" value={data.instituicao} onChange={(e) => set("instituicao", sanitizeFormationText(e.target.value))} {...fieldError(errors.instituicao, attempted)} slotProps={{ htmlInput: { maxLength: 200, onPaste: stripEmojiOnPaste } }} />
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField required type="text" label="Início" value={data.dataInicio} onChange={(e) => setDate("dataInicio", e.target.value)} placeholder="dd/mm/aaaa" {...fieldError(errors.dataInicio, attempted)} slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }} />
      <TextField disabled={data.status === "EM_ANDAMENTO"} required={data.status === "CONCLUIDO"} type="text" label="Conclusão" value={data.dataFim ?? ""} onChange={(e) => setDate("dataFim", e.target.value)} placeholder="dd/mm/aaaa" {...fieldError(errors.dataFim, attempted)} slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }} />
    </Stack>
    <TextField type="text" label="Carga horária" value={data.cargaHoraria ?? ""} onChange={(e) => { const digits = sanitizeIntegerInput(e.target.value, 5); set("cargaHoraria", digits ? Number(digits) : null); }} {...fieldError(errors.cargaHoraria, attempted)} slotProps={{ input: { endAdornment: <InputAdornment position="end">horas</InputAdornment> }, htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }} />
    <TextField select label="Status" value={data.status} onChange={(e) => { const status = e.target.value as StatusFormacao; setData((p) => ({ ...p, status, dataFim: status === "EM_ANDAMENTO" ? null : p.dataFim })); }}>{Object.entries(formationStatus).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>
    <FormControlLabel control={<Switch checked={data.principal} onChange={(e) => set("principal", e.target.checked)} />} label="Formação principal" />
    <FormControlLabel control={<Switch checked={data.ehRioPombaValley} onChange={(e) => set("ehRioPombaValley", e.target.checked)} />} label="Formação no Rio Pomba Valley" />
  </Stack></FormDialog>;
}

function ExperienceForm({ item, onClose, onSaved }: { item?: ExperienciaResponse; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<ExperienciaRequest>(item ? { empresa: item.empresa, cargo: item.cargo, tipo: item.tipo, dataInicio: formatDateInput(item.dataInicio), dataFim: formatDateInput(item.dataFim), atual: item.atual, descricao: item.descricao } : { empresa: "", cargo: "", tipo: "PROFISSIONAL", dataInicio: "", dataFim: null, atual: false, descricao: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const set = <K extends keyof ExperienciaRequest,>(key: K, value: ExperienciaRequest[K]) => setData((p) => ({ ...p, [key]: value }));
  const setDate = (key: "dataInicio" | "dataFim", value: string) => {
    const masked = maskDateInput(value);
    set(key, (masked || (key === "dataInicio" ? "" : null)) as ExperienciaRequest[typeof key]);
  };
  const empresa = data.empresa.trim();
  const cargo = data.cargo.trim();
  const dates = validateDatePeriod(data.dataInicio, data.atual ? null : data.dataFim, data.atual ? null : "Informe a data de término.");
  const errors = { empresa: validateCompanyName(empresa), cargo: validateJobTitle(cargo), dataInicio: dates.start, dataFim: dates.end };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setError(null);
    const dataInicio = parseDateInput(data.dataInicio);
    const dataFim = data.dataFim ? parseDateInput(data.dataFim) : null;
    if (Object.values(errors).some(Boolean) || !dataInicio) return;
    setSaving(true);
    setError(null);
    try {
      const request = { ...data, empresa, cargo, dataInicio, dataFim: data.atual ? null : dataFim };
      if (item) await updateExperiencia(item.id, request);
      else await createExperiencia(request);
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível salvar a experiência."));
    } finally {
      setSaving(false);
    }
  };
  return <FormDialog title={item ? "Editar experiência" : "Adicionar experiência"} onClose={onClose} onSubmit={submit} saving={saving} error={error} focusFirstInvalid><Stack spacing={2}>
    <TextField required label="Empresa" value={data.empresa} onChange={(e) => set("empresa", sanitizeFormationText(e.target.value))} {...fieldError(errors.empresa, attempted)} slotProps={{ htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste } }} />
    <TextField required label="Cargo" value={data.cargo} onChange={(e) => set("cargo", sanitizeFormationText(e.target.value))} {...fieldError(errors.cargo, attempted)} slotProps={{ htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste } }} />
    <TextField select label="Tipo" value={data.tipo} onChange={(e) => set("tipo", e.target.value as TipoExperiencia)}>{Object.entries(experienceLabels).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <TextField required type="text" label="Início" value={data.dataInicio ?? ""} onChange={(e) => setDate("dataInicio", e.target.value)} placeholder="dd/mm/aaaa" {...fieldError(errors.dataInicio, attempted)} slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }} />
      <TextField disabled={data.atual} required={!data.atual} type="text" label="Término" value={data.dataFim ?? ""} onChange={(e) => setDate("dataFim", e.target.value)} placeholder="dd/mm/aaaa" {...fieldError(errors.dataFim, attempted)} slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 10 } }} />
    </Stack>
    <FormControlLabel control={<Switch checked={data.atual} onChange={(e) => setData((p) => ({ ...p, atual: e.target.checked, dataFim: e.target.checked ? null : p.dataFim }))} />} label="Trabalho atual" />
    <TextField label="Descrição" multiline minRows={3} value={data.descricao ?? ""} onChange={(e) => set("descricao", stripEmoji(e.target.value).slice(0, 2000) || null)} helperText={`${(data.descricao ?? "").length}/2000`} slotProps={{ htmlInput: { maxLength: 2000, onPaste: stripEmojiOnPaste } }} />
  </Stack></FormDialog>;
}

function DeleteDialog({ item, onClose, onDeleted }: { item: TrajetoriaItemResponse | null; onClose: () => void; onDeleted: () => void }) { const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const close = () => { setError(null); onClose(); }; const remove = async () => { if (!item) return; setSaving(true); setError(null); try { if (item.formacao) { await deleteFormacao(item.id); } else { await deleteExperiencia(item.id); } onDeleted(); } catch (e) { setError(e instanceof ApiError && e.status === 404 ? "Este item já não existe. Atualize a página." : getApiErrorMessage(e, "Não foi possível remover o item.")); } finally { setSaving(false); } }; return <Dialog open={item !== null} onClose={close} aria-labelledby="delete-trajectory-title"><DialogTitle id="delete-trajectory-title">Excluir {item?.formacao ? "formação" : "experiência"}?</DialogTitle><DialogContent>{error && <Alert severity="error">{error}</Alert>}<Typography>Você removerá “{item?.titulo}”. {item?.formacao && "O certificado associado também será removido."}</Typography></DialogContent><DialogActions><Button onClick={close} disabled={saving}>Cancelar</Button><Button color="error" variant="contained" onClick={() => void remove()} disabled={saving}>{saving ? "Excluindo..." : "Excluir"}</Button></DialogActions></Dialog>; }
