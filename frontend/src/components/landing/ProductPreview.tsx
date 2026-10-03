import { Avatar, Chip } from "@mui/material";
import { CheckBox, CheckBoxOutlineBlank, PlaceOutlined, SearchOutlined, VerifiedOutlined } from "@mui/icons-material";

/** Static illustrations with fictional data: each wrapper is a single labelled image, its content is hidden from assistive tech and never focusable. */

function initials(name: string) {
  return name.split(" ").map(part => part[0]).join("");
}

function TalentProfilePreview() {
  return <div className="product-preview" role="img" aria-label="Ilustração: exemplo de perfil de talento">
    <div className="preview-card" aria-hidden="true">
      <header className="preview-person">
        <Avatar className="preview-avatar">{initials("Marina Couto")}</Avatar>
        <div><h3>Marina Couto</h3><p><PlaceOutlined/>Rio Pomba, MG</p></div>
      </header>
      <div className="preview-block">
        <span className="preview-label">Formação principal</span>
        <p className="preview-formation">Tecnólogo em Análise e Desenvolvimento de Sistemas <small>Concluído</small></p>
        <Chip className="preview-verified" size="small" icon={<VerifiedOutlined/>} label="RPV verificado"/>
      </div>
      <div className="preview-block">
        <span className="preview-label">Competências</span>
        <div className="preview-chips">{["React", "TypeScript", "Node.js", "SQL", "Figma"].map(item => <Chip key={item} className="preview-chip" size="small" variant="outlined" label={item}/>)}</div>
      </div>
      <div className="preview-block">
        <span className="preview-label">Disponibilidade</span>
        <div className="preview-chips">{["Estágio", "CLT", "Híbrido", "Remoto"].map(item => <Chip key={item} className="preview-chip" size="small" variant="outlined" label={item}/>)}</div>
      </div>
    </div>
  </div>;
}

const results = [
  { name: "Marina Couto", formation: "Tecnólogo em ADS", skills: ["React", "TypeScript", "SQL"], selected: true },
  { name: "Rafael Teixeira", formation: "Graduação em Sistemas de Informação", skills: ["React", "Node.js", "Git"], selected: true },
  { name: "Beatriz Lacerda", formation: "Técnico em Informática", skills: ["React", "JavaScript", "UX"], selected: false },
];

function TalentSearchPreview() {
  return <div className="product-preview" role="img" aria-label="Ilustração: exemplo de busca de talentos com filtros e resultados">
    <div className="preview-card" aria-hidden="true">
      <div className="preview-search"><SearchOutlined/><span>React</span></div>
      <div className="preview-chips">{["Competência: React", "Cidade: Rio Pomba"].map(item => <Chip key={item} className="preview-chip" size="small" variant="outlined" label={item}/>)}<Chip className="preview-verified" size="small" icon={<VerifiedOutlined/>} label="Formação RPV verificada"/></div>
      <span className="preview-label">3 talentos encontrados</span>
      <ul className="preview-results">{results.map(item => <li key={item.name}>
        {item.selected ? <CheckBox className="preview-check is-checked"/> : <CheckBoxOutlineBlank className="preview-check"/>}
        <Avatar className="preview-avatar">{initials(item.name)}</Avatar>
        <div><h3>{item.name}</h3><p>Rio Pomba, MG · {item.formation}</p><div className="preview-chips">{item.skills.map(skill => <Chip key={skill} className="preview-chip" size="small" variant="outlined" label={skill}/>)}</div></div>
      </li>)}</ul>
    </div>
  </div>;
}

export function ProductPreview({ audience }: { audience: "talent" | "company" }) {
  return audience === "talent" ? <TalentProfilePreview/> : <TalentSearchPreview/>;
}
