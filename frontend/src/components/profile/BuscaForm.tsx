"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  Autocomplete,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getApiErrorMessage } from "@/lib/api";
import { disponivelAgora } from "@/lib/busca";
import { formatDateInput, maskDateInput, parseDateInput } from "@/lib/format";
import {
  AREA_INTERESSE_GRUPOS,
  AREA_INTERESSE_LABELS,
  AREA_INTERESSE_OPCOES,
  CARGA_HORARIA_LABELS,
  CARGA_HORARIA_OPCOES,
  CATEGORIA_CNH_LABELS,
  CATEGORIA_CNH_OPCOES,
  DISPONIBILIDADE_LABELS,
  DISPONIBILIDADE_OPCOES,
  MODALIDADE_LABELS,
  MODALIDADE_OPCOES,
  STATUS_BUSCA_LABELS,
  STATUS_BUSCA_OPCOES,
  TIPO_DEFICIENCIA_LABELS,
  TIPO_DEFICIENCIA_OPCOES,
} from "@/lib/labels";
import { updateDisponibilidade } from "@/lib/student";
import { OBJETIVO_MAX_LENGTH, sanitizeObjetivo, validateBrazilianDateInput } from "@/lib/validation";
import type {
  AreaInteresse,
  CargaHorariaSemanal,
  CategoriaCnh,
  MeResponse,
  StatusBusca,
  TipoDeficiencia,
} from "@/types/student";
import { FormDialog, fieldError } from "./FormDialog";

const MAX_AREAS = 5;
const NAO_INFORMAR = "";
const CONSENTIMENTO_OBRIGATORIO = "Marque a autorização para salvar as informações PCD.";

type InicioModo = "nenhum" | "imediato" | "data";

interface PcdState {
  souPcd: boolean;
  interesseVagaPcd: boolean;
  tipos: TipoDeficiencia[];
  consentimento: boolean;
}

const AREA_GRUPO: Record<string, string> = Object.fromEntries(
  AREA_INTERESSE_GRUPOS.flatMap((grupo) => grupo.areas.map((area) => [area, grupo.titulo])),
);

interface MultiSelectProps<T extends string> {
  label: string;
  placeholder: string;
  options: T[];
  labels: Record<T, string>;
  value: T[];
  onChange: (value: T[]) => void;
  disabled: boolean;
  groupBy?: (option: T) => string;
  max?: number;
  helperText?: string;
}

// Multiple choice with a checkbox per option, like every list picker of the profile.
function MultiSelect<T extends string>({
  label,
  placeholder,
  options,
  labels,
  value,
  onChange,
  disabled,
  groupBy,
  max,
  helperText,
}: Readonly<MultiSelectProps<T>>) {
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      disabled={disabled}
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      groupBy={groupBy}
      getOptionLabel={(option) => labels[option]}
      getOptionDisabled={(option) => max !== undefined && value.length >= max && !value.includes(option)}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} helperText={helperText} />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            <Checkbox checked={value.includes(option)} size="small" sx={{ mr: 1 }} />
            {labels[option]}
          </li>
        );
      }}
    />
  );
}

interface FormBlockProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

// A titled group of related fields, announced as a group by assistive technology.
function FormBlock({ title, hint, children }: Readonly<FormBlockProps>) {
  const titleId = useId();
  return (
    <Stack spacing={0.5} role="group" aria-labelledby={titleId}>
      <Typography id={titleId} component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
      {children}
    </Stack>
  );
}

function initialInicioModo(busca: MeResponse["busca"]): InicioModo {
  if (disponivelAgora(busca)) return "imediato";
  return busca.disponivelAPartirDe ? "data" : "nenhum";
}

function erroDataInicio(modo: InicioModo, data: string): string | null {
  if (modo !== "data") return null;
  return data ? validateBrazilianDateInput(data) : "Informe a data de início.";
}

interface InicioDisponibilidadeProps {
  modo: InicioModo;
  onModo: (modo: InicioModo) => void;
  data: string;
  onData: (data: string) => void;
  error: ReturnType<typeof fieldError>;
  disabled: boolean;
}

function InicioDisponibilidade({ modo, onModo, data, onData, error, disabled }: Readonly<InicioDisponibilidadeProps>) {
  return (
    <Stack spacing={1}>
      <FormControl component="fieldset" disabled={disabled}>
        <FormLabel component="legend">Disponível a partir de</FormLabel>
        <RadioGroup row value={modo} onChange={(event) => onModo(event.target.value as InicioModo)}>
          <FormControlLabel value="nenhum" control={<Radio size="small" />} label="Não informar" />
          <FormControlLabel value="imediato" control={<Radio size="small" />} label="Imediato" />
          <FormControlLabel value="data" control={<Radio size="small" />} label="A partir de uma data" />
        </RadioGroup>
      </FormControl>
      {modo === "data" && (
        <TextField
          label="Data de início"
          placeholder="dd/mm/aaaa"
          value={data}
          onChange={(event) => onData(maskDateInput(event.target.value))}
          disabled={disabled}
          required
          sx={{ maxWidth: 240 }}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
          {...error}
        />
      )}
    </Stack>
  );
}

interface PcdBlockProps {
  pcd: PcdState;
  onChange: (patch: Partial<PcdState>) => void;
  consentimentoErro: boolean;
  disabled: boolean;
}

// Optional and sensitive: recruiters only see it when the student authorizes it here.
function PcdBlock({ pcd, onChange, consentimentoErro, disabled }: Readonly<PcdBlockProps>) {
  const preenchido = pcd.souPcd || pcd.interesseVagaPcd;
  return (
    <FormBlock
      title="Pessoa com deficiência (PCD)"
      hint="Opcional. É uma informação sensível: só recrutadores cadastrados e administradores do Instituto veem, e apenas se você autorizar abaixo. Para apagar, desmarque as opções e salve."
    >
      <FormControlLabel
        disabled={disabled}
        control={<Checkbox checked={pcd.souPcd} onChange={(event) => onChange({ souPcd: event.target.checked })} />}
        label="Sou pessoa com deficiência (PCD)"
      />
      {pcd.souPcd && (
        <MultiSelect
          label="Tipos de deficiência"
          placeholder="Escolha um ou mais tipos"
          options={TIPO_DEFICIENCIA_OPCOES}
          labels={TIPO_DEFICIENCIA_LABELS}
          value={pcd.tipos}
          onChange={(tipos) => onChange({ tipos })}
          disabled={disabled}
        />
      )}
      <FormControlLabel
        disabled={disabled}
        control={
          <Checkbox
            checked={pcd.interesseVagaPcd}
            onChange={(event) => onChange({ interesseVagaPcd: event.target.checked })}
          />
        }
        label="Tenho interesse em vagas para PCD"
      />
      {preenchido && (
        <FormControl error={consentimentoErro}>
          <FormControlLabel
            disabled={disabled}
            control={
              <Checkbox
                checked={pcd.consentimento}
                onChange={(event) => onChange({ consentimento: event.target.checked })}
                slotProps={{ input: { "aria-invalid": consentimentoErro, "aria-required": true } }}
              />
            }
            label="Autorizo compartilhar esta informação com recrutadores cadastrados"
          />
          {consentimentoErro && <FormHelperText>{CONSENTIMENTO_OBRIGATORIO}</FormHelperText>}
        </FormControl>
      )}
    </FormBlock>
  );
}

interface BuscaFormProps {
  profile: MeResponse;
  onClose: () => void;
  onSaved: () => void;
}

// Whole "O que eu busco" form in one dialog. Saving replaces everything and reconfirms the status.
export function BuscaForm({ profile, onClose, onSaved }: Readonly<BuscaFormProps>) {
  const { busca } = profile;
  const [status, setStatus] = useState<StatusBusca | null>(busca.status);
  const [objetivo, setObjetivo] = useState(() => sanitizeObjetivo(busca.objetivo ?? ""));
  const [areas, setAreas] = useState<AreaInteresse[]>(busca.areasInteresse);
  const [disponibilidades, setDisponibilidades] = useState(profile.disponibilidades);
  const [modalidades, setModalidades] = useState(profile.modalidades);
  const [inicioModo, setInicioModo] = useState<InicioModo>(() => initialInicioModo(busca));
  const [inicioData, setInicioData] = useState(() =>
    disponivelAgora(busca) ? "" : formatDateInput(busca.disponivelAPartirDe),
  );
  const [cargaHoraria, setCargaHoraria] = useState<CargaHorariaSemanal | null>(busca.cargaHoraria);
  const [aceitaViajar, setAceitaViajar] = useState(busca.aceitaViajar);
  const [aceitaMudarDeCidade, setAceitaMudarDeCidade] = useState(busca.aceitaMudarDeCidade);
  const [categoriasCnh, setCategoriasCnh] = useState<CategoriaCnh[]>(busca.categoriasCnh);
  const [possuiVeiculoProprio, setPossuiVeiculoProprio] = useState(busca.possuiVeiculoProprio);
  const [pcd, setPcd] = useState<PcdState>({
    souPcd: busca.pcd.souPcd,
    interesseVagaPcd: busca.pcd.interesseVagaPcd,
    tipos: busca.pcd.tipos,
    consentimento: busca.pcd.consentimentoEm !== null,
  });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcdPreenchido = pcd.souPcd || pcd.interesseVagaPcd;
  const dataError = erroDataInicio(inicioModo, inicioData);
  const consentimentoErro = pcdPreenchido && !pcd.consentimento;

  function toggleCnh(categoria: CategoriaCnh) {
    setCategoriasCnh((atual) =>
      atual.includes(categoria) ? atual.filter((item) => item !== categoria) : [...atual, categoria],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (dataError || consentimentoErro) return;
    setError(null);
    setSaving(true);
    try {
      await updateDisponibilidade({
        disponibilidades,
        modalidades,
        statusBusca: status,
        objetivoProfissional: objetivo.trim() || null,
        areasInteresse: areas,
        disponivelImediatamente: inicioModo === "imediato",
        disponivelAPartirDe: inicioModo === "data" ? parseDateInput(inicioData) : null,
        cargaHorariaSemanal: cargaHoraria,
        aceitaViajar,
        aceitaMudarDeCidade,
        categoriasCnh,
        possuiVeiculoProprio,
        souPcd: pcd.souPcd,
        interesseVagaPcd: pcd.interesseVagaPcd,
        tiposDeficiencia: pcd.souPcd ? pcd.tipos : [],
        consentimentoPcd: pcdPreenchido && pcd.consentimento,
      });
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível salvar o que você busca. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Editar o que eu busco"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
      maxWidth="md"
      focusFirstInvalid
    >
      <Stack spacing={3}>
        <FormControl component="fieldset" disabled={saving}>
          <FormLabel component="legend">Situação de busca</FormLabel>
          <RadioGroup
            value={status ?? NAO_INFORMAR}
            onChange={(event) => setStatus(event.target.value as StatusBusca)}
          >
            {STATUS_BUSCA_OPCOES.map((opcao) => (
              <FormControlLabel
                key={opcao}
                value={opcao}
                control={<Radio size="small" />}
                label={STATUS_BUSCA_LABELS[opcao]}
              />
            ))}
          </RadioGroup>
          <FormHelperText>
            Salvar este formulário confirma a situação. Quem marca &quot;Não estou buscando agora&quot; continua aparecendo
            para recrutadores, com um aviso.
          </FormHelperText>
        </FormControl>

        <TextField
          label="Objetivo profissional"
          value={objetivo}
          onChange={(event) => setObjetivo(sanitizeObjetivo(event.target.value))}
          multiline
          minRows={2}
          fullWidth
          disabled={saving}
          helperText={`${objetivo.length} de ${OBJETIVO_MAX_LENGTH} caracteres. Escreva em um único parágrafo.`}
          slotProps={{ htmlInput: { maxLength: OBJETIVO_MAX_LENGTH } }}
        />

        <MultiSelect
          label="Áreas de interesse"
          placeholder="Escolha até 5 áreas"
          options={AREA_INTERESSE_OPCOES}
          labels={AREA_INTERESSE_LABELS}
          value={areas}
          onChange={setAreas}
          disabled={saving}
          groupBy={(area) => AREA_GRUPO[area] ?? ""}
          max={MAX_AREAS}
          helperText={`${areas.length} de ${MAX_AREAS} áreas escolhidas`}
        />

        <MultiSelect
          label="Tipos de vaga"
          placeholder="Estágio, CLT, PJ..."
          options={DISPONIBILIDADE_OPCOES}
          labels={DISPONIBILIDADE_LABELS}
          value={disponibilidades}
          onChange={setDisponibilidades}
          disabled={saving}
        />

        <MultiSelect
          label="Modalidade de trabalho"
          placeholder="Presencial, híbrido ou remoto"
          options={MODALIDADE_OPCOES}
          labels={MODALIDADE_LABELS}
          value={modalidades}
          onChange={setModalidades}
          disabled={saving}
        />

        <InicioDisponibilidade
          modo={inicioModo}
          onModo={setInicioModo}
          data={inicioData}
          onData={setInicioData}
          error={fieldError(dataError, attempted)}
          disabled={saving}
        />

        <TextField
          select
          label="Carga horária semanal"
          value={cargaHoraria ?? NAO_INFORMAR}
          onChange={(event) => setCargaHoraria((event.target.value || null) as CargaHorariaSemanal | null)}
          disabled={saving}
          sx={{ maxWidth: 360 }}
        >
          <MenuItem value={NAO_INFORMAR}>Não informar</MenuItem>
          {CARGA_HORARIA_OPCOES.map((opcao) => (
            <MenuItem key={opcao} value={opcao}>
              {CARGA_HORARIA_LABELS[opcao]}
            </MenuItem>
          ))}
        </TextField>

        <Divider />

        <FormBlock title="Mobilidade">
          <FormControlLabel
            disabled={saving}
            control={<Checkbox checked={aceitaViajar} onChange={(event) => setAceitaViajar(event.target.checked)} />}
            label="Aceito viajar a trabalho"
          />
          <FormControlLabel
            disabled={saving}
            control={
              <Checkbox
                checked={aceitaMudarDeCidade}
                onChange={(event) => setAceitaMudarDeCidade(event.target.checked)}
              />
            }
            label="Aceito mudar de cidade"
          />
        </FormBlock>

        <FormBlock
          title="Habilitação"
          hint="Informação declarada por você. Não pedimos número, foto nem documento da CNH."
        >
          <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", columnGap: 2 }}>
            {CATEGORIA_CNH_OPCOES.map((categoria) => (
              <FormControlLabel
                key={categoria}
                disabled={saving}
                control={<Checkbox checked={categoriasCnh.includes(categoria)} onChange={() => toggleCnh(categoria)} />}
                label={`CNH ${CATEGORIA_CNH_LABELS[categoria]}`}
              />
            ))}
          </Stack>
          <FormControlLabel
            disabled={saving}
            control={
              <Checkbox
                checked={possuiVeiculoProprio}
                onChange={(event) => setPossuiVeiculoProprio(event.target.checked)}
              />
            }
            label="Possuo veículo próprio"
          />
        </FormBlock>

        <Divider />

        <PcdBlock
          pcd={pcd}
          onChange={(patch) => setPcd((atual) => ({ ...atual, ...patch }))}
          consentimentoErro={attempted && consentimentoErro}
          disabled={saving}
        />
      </Stack>
    </FormDialog>
  );
}
