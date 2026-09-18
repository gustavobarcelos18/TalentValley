"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Tab, Tabs } from "@mui/material";
import { KeyboardArrowDown, ArrowForward, NorthEast, VisibilityOutlined, HubOutlined, LayersOutlined } from "@mui/icons-material";
import { useAuth } from "@/hooks/useAuth";
import { ValleyScene, SceneContours, SceneConnections } from "./ValleyScene";
import { PublicHeader } from "./PublicHeader";
import { Brand } from "./Brand";
import { destinations } from "./navigation";
import { LandingMotion } from "./motion/LandingMotion";
import { useLandingEntrance } from "./motion/useLandingEntrance";
import { useHeroDepth } from "./motion/useHeroDepth";
import { useSectionStories } from "./motion/useSectionStories";
import { ActionMotion } from "./motion/ActionMotion";
import { StorySteps } from "./motion/StorySteps";
import "./landing.css";

function JoinActions({ audience, hero = false }: { audience?: "talent" | "company"; hero?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="join-placeholder" role="status"><span className="sr-only">Verificando sessão…</span></div>;
  if (hero) return <HeroActions user={user} />;
  if (user) return <div className="join-actions"><ActionMotion><Button component={Link} href={destinations[user.role]} variant="contained" endIcon={<ArrowForward />}>Acessar minha área</Button></ActionMotion></div>;
  return <div className="join-actions">
    {audience !== "company" && <ActionMotion><Button component={Link} href="/cadastro/aluno" variant="contained" endIcon={<ArrowForward />}>Sou Talento</Button></ActionMotion>}
    {audience !== "talent" && <ActionMotion><Button component={Link} href="/cadastro/recrutador" variant={audience ? "contained" : "outlined"} endIcon={<ArrowForward />}>Sou Recrutador</Button></ActionMotion>}
  </div>;
}

function HeroActions({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const entrance = useLandingEntrance();
  const actions = user
    ? [{ href: destinations[user.role], label: "Acessar minha área", contained: true }]
    : [{ href: "/cadastro/aluno", label: "Sou Talento", contained: true }, { href: "/cadastro/recrutador", label: "Sou Recrutador", contained: false }];
  return <div ref={entrance} className="join-actions" data-motion-scope>{actions.map((action, index) =>
    <div key={action.href} data-entrance={0.8 + index * 0.1} data-hero-action>
      <ActionMotion>
        <Button component={Link} href={action.href} variant={action.contained ? "contained" : "outlined"} endIcon={<ArrowForward />}>{action.label}</Button>
      </ActionMotion>
    </div>
  )}</div>;
}

function NetworkPanel({ company = false }: { company?: boolean }) {
  return <div className={`network-panel ${company ? "company-network" : ""}`} aria-hidden="true">
    <span className="panel-coordinate">RPV / {company ? "CONEXÕES" : "TRAJETÓRIAS"}</span>
    <ValleyScene compact />
    <div className="panel-glow"/>
    <svg className="story-paths" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d="M50 49 Q25 48 24 27"/><path className="path-light" pathLength="100" d="M50 49 Q25 48 24 27"/><path d="M50 49 Q68 52 82 37"/><path d="M50 49 Q62 70 45 79"/>
    </svg>
    <div className="network-orbit orbit-one"/><div className="network-orbit orbit-two"/>
    <span className="network-label label-one">{company ? "Competências" : "Formação"}</span>
    <span className="network-label label-two">{company ? "Potencial" : "Projetos"}</span>
    <span className="network-label label-three">{company ? "Talentos" : "Oportunidades"}</span>
    <div className="network-center"><HubOutlined/><span>{company ? "Sua próxima conexão" : "Seu próximo capítulo"}</span></div>
    <span className="panel-caption">PESSOAS. POSSIBILIDADES. CONEXÕES.</span>
  </div>;
}

export function LandingPage() {
  return <LandingMotion><LandingContent /></LandingMotion>;
}

function LandingContent() {
  const entrance = useLandingEntrance();
  const hero = useRef<HTMLElement>(null);
  useHeroDepth(hero);
  useSectionStories(entrance);
  const { user } = useAuth();
  const [audience, setAudience] = useState(0);

  return <div className="landing" ref={entrance} data-motion-scope>
    <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
    <PublicHeader />

    <main id="conteudo" tabIndex={-1}>
      <section ref={hero} id="hero" tabIndex={-1} className="hero" aria-labelledby="hero-title">
        <div className="hero-background-scroll" aria-hidden="true"><div className="hero-background" data-entrance="0" data-entrance-fade /></div>
        <div className="hero-atmosphere" aria-hidden="true"><div className="hero-glow" data-entrance="0" data-entrance-fade /></div>
        <div className="hero-technology" aria-hidden="true"><div className="hero-technology-depth"><svg viewBox="0 0 1440 680" preserveAspectRatio="xMidYMax slice" fill="none" data-entrance="1.15" data-entrance-fade><SceneContours compact /><SceneConnections /></svg></div></div>
        <div className="hero-exit-shade" aria-hidden="true"/>
        <div className="hero-copy"><div className="hero-copy-depth">
          <div className="hero-headline-scroll"><h1 id="hero-title"><span className="hero-title-line" data-entrance="0.16">Talento <span>encontra</span></span><br/><span className="hero-title-line" data-entrance="0.3"><em>oportunidade</em> aqui.</span></h1></div>
          <div className="hero-subtitle-scroll"><p className="hero-subtitle" data-entrance="0.48">Onde talentos e oportunidades se encontram.</p></div>
          <div className="hero-institutional-scroll"><p className="institutional-line" data-entrance="0.62">Uma iniciativa Rio Pomba Valley</p></div>
          <div className="hero-actions-scroll"><JoinActions hero /></div>
        </div></div>
        <a className="explore-link" href="#proposta" aria-label="Rolar para explorar"><KeyboardArrowDown/></a>
      </section>

      <section data-story="value" id="proposta" className="section value-section" aria-labelledby="value-title"><span className="story-continuity" aria-hidden="true"/>
        <div className="value-cover" aria-hidden="true"/><div className="section-heading"><p className="eyebrow">UM ECOSSISTEMA DE POSSIBILIDADES</p><h2 id="value-title"><span className="title-mask"><span className="title-plane">Talento, formação e</span></span><span className="title-mask"><span className="title-plane">mercado <em>conectados.</em></span></span></h2></div>
        <div className="value-grid grid md:grid-cols-3">
          {[[VisibilityOutlined,"Visibilidade","Sua trajetória ganha espaço. Seu potencial chega a quem busca novos talentos."],[HubOutlined,"Conexão","Pessoas e empresas se aproximam por competências, interesses e possibilidades reais."],[LayersOutlined,"Ecossistema","Educação, tecnologia e mercado fortalecem juntos o futuro da nossa região."]].map(([Icon,title,copy]) => { const Symbol = Icon as typeof VisibilityOutlined; return <article key={String(title)}><Symbol aria-hidden="true"/><h3>{String(title)}</h3><p>{String(copy)}</p></article>; })}
        </div>
      </section>

      <section data-story="talent" id="talentos" tabIndex={-1} className="section audience-section grid lg:grid-cols-2" aria-labelledby="talents-title"><span className="story-continuity" aria-hidden="true"/>
        <div className="audience-copy"><p className="eyebrow">01 / PARA TALENTOS</p><h2 id="talents-title">Seu potencial<br/>merece ser <em>encontrado.</em></h2><p>Você tem uma história para construir. Crie seu perfil profissional, apresente sua formação, competências e trajetória e ganhe visibilidade no ecossistema Rio Pomba Valley.</p><ul className="benefits"><li><span>01</span>Monte seu perfil</li><li><span>02</span>Mostre sua trajetória</li><li><span>03</span>Seja encontrado</li></ul><div className="story-action"><JoinActions audience="talent"/></div></div>
        <NetworkPanel />
      </section>

      <section data-story="company" id="empresas" tabIndex={-1} className="section audience-section company-section grid lg:grid-cols-2" aria-labelledby="companies-title"><span className="story-continuity" aria-hidden="true"/>
        <NetworkPanel company />
        <div className="audience-copy"><p className="eyebrow">02 / PARA RECRUTADORES</p><h2 id="companies-title">Encontre talento<br/>onde ele está <em>nascendo.</em></h2><p>O próximo talento da sua equipe pode estar mais perto do que você imagina. Conheça profissionais da região, explore competências e formação e descubra o potencial por trás de cada trajetória.</p><div className="company-note"><NorthEast aria-hidden="true"/><p>Conexões locais.<br/><strong>Possibilidades que vão além.</strong></p></div><div className="story-action"><JoinActions audience="company"/></div></div>
      </section>

      <section data-story="how" id="como-funciona" tabIndex={-1} className="how-section" aria-labelledby="how-title"><span className="story-continuity" aria-hidden="true"/><div className="section">
        <div className="section-heading"><p className="eyebrow">SIMPLES PARA COMEÇAR</p><h2 id="how-title">Seu próximo passo.<br/><em>Uma nova possibilidade.</em></h2></div>
        <Tabs className="audience-tabs" value={audience} onChange={(_, value: number) => setAudience(value)} centered aria-label="Como funciona para cada público"><Tab id="how-tab-0" aria-controls="how-panel-0" label="Para talentos"/><Tab id="how-tab-1" aria-controls="how-panel-1" label="Para empresas"/></Tabs>
        <StorySteps audience={audience}/>
      </div></section>

      <section data-story="institution" id="rio-pomba-valley" tabIndex={-1} className="section institution-section" aria-labelledby="rpv-title"><span className="story-continuity" aria-hidden="true"/>
        <div className="institution-scene" aria-hidden="true"><ValleyScene compact /></div><div className="institution-brand"><Image src="/brand/rio-pomba-valley.png" width={291} height={244} alt="Rio Pomba Valley MG.BR — marca institucional original"/><span>ORIGEM LOCAL. VOCAÇÃO PARA O FUTURO.</span></div>
        <div className="institution-copy"><p className="eyebrow">NOSSA ORIGEM, NOSSA FORÇA</p><h2 id="rpv-title">Um vale de pessoas.<br/><em>Um mundo de potencial.</em></h2><p>O Rio Pomba Valley conecta pessoas, empresas, educação, tecnologia e inovação. Uma rede que valoriza o conhecimento da nossa região e abre caminhos para o seu desenvolvimento.</p><p>O Talent Valley nasce dessa conexão: um espaço para aproximar quem está construindo sua trajetória de quem acredita no seu potencial.</p><div className="ecosystem-words"><span>Pessoas</span><span>Educação</span><span>Empresas</span><span>Tecnologia</span><span>Inovação</span></div></div>
      </section>
    </main>
    <footer className="landing-footer"><div className="footer-main"><Link className="brand-link" href="#hero"><Brand/></Link><p>O próximo capítulo começa com uma conexão.</p><Link href={user ? destinations[user.role] : "/login"}>{user ? "Minha área" : "Login"}<NorthEast fontSize="small"/></Link></div><div className="footer-bottom"><span>Talent Valley · Uma iniciativa Rio Pomba Valley</span><span>Feito de pessoas. Conectado ao futuro.</span></div></footer>
  </div>;
}
