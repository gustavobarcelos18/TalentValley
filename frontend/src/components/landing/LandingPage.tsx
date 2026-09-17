"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Avatar, Button, IconButton, Switch, Tab, Tabs, useColorScheme } from "@mui/material";
import { KeyboardArrowDown, ArrowForward, Close, DarkModeOutlined, LightModeOutlined, Menu, NorthEast, VisibilityOutlined, HubOutlined, LayersOutlined } from "@mui/icons-material";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { ValleyScene, SceneContours, SceneConnections } from "./ValleyScene";
import { LandingMotion, useLandingMotionPolicy } from "./motion/LandingMotion";
import { useLandingEntrance } from "./motion/useLandingEntrance";
import { useHeroDepth } from "./motion/useHeroDepth";
import "./landing.css";

const navigation = [["hero", "Hero"], ["como-funciona", "Como funciona"], ["talentos", "Talentos"], ["empresas", "Empresas"], ["rio-pomba-valley", "Rio Pomba Valley"]];
const destinations = { ALUNO: "/meu-perfil", RECRUTADOR: "/recrutador", ADMIN: "/admin" };

function Brand() {
  return <span className="tv-brand"><svg width="102" height="50" viewBox="0 0 102 50" fill="none" aria-hidden="true"><path d="M2 46 49 4 66 21 77 14 100 46Z" fill="#008F73"/><path d="m2 46 24-22 12 17Z" fill="#00B838"/><path d="m24 24 25-20-11 37Z" fill="#A0D060"/><path d="m49 4 17 17-28 20Z" fill="#00B838"/><path d="m49 4 7 25 10-8Z" fill="#D8E9B8"/><path d="m56 29 10-8 11 17-20 8Z" fill="#20C8C0"/><path d="m66 21 11-7 8 15Z" fill="#73BB40"/><path d="m77 38 8-9 15 17H57Z" fill="#A0D060"/><path d="M2 46 49 4 66 21 77 14 100 46ZM24 24l32 5 21 9M49 4l7 25-18 12L24 24M56 29l10-8 19 8-8 9 23 8M38 41l-36 5m36-5 18-12" stroke="currentColor" strokeOpacity=".7" strokeWidth=".8"/><path d="M56 29q15 7 1 17" stroke="#F4F7F6" strokeWidth="2"/><circle cx="24" cy="24" r="2" fill="#F4F7F6"/><circle cx="56" cy="29" r="3" fill="#F4F7F6"/><circle cx="77" cy="38" r="2" fill="#F4F7F6"/></svg><span><strong>Talent <em>Valley</em></strong><small>by Rio Pomba Valley</small></span></span>;
}

function JoinActions({ audience, hero = false }: { audience?: "talent" | "company"; hero?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="join-placeholder" role="status"><span className="sr-only">Verificando sessão…</span></div>;
  if (hero) return <HeroActions user={user} />;
  if (user) return <div className="join-actions"><Button component={Link} href={destinations[user.role]} variant="contained" endIcon={<ArrowForward />}>Acessar minha área</Button></div>;
  return <div className="join-actions">
    {audience !== "company" && <Button component={Link} href="/cadastro/aluno" variant="contained" endIcon={<ArrowForward />}>Sou pombinho</Button>}
    {audience !== "talent" && <Button component={Link} href="/cadastro/recrutador" variant={audience ? "contained" : "outlined"} endIcon={<ArrowForward />}>Sou recrutador</Button>}
  </div>;
}

function HeroActions({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const entrance = useLandingEntrance();
  const policy = useLandingMotionPolicy();
  const hover = policy === "desktop" ? { y: -3 } : undefined;
  const actions = user
    ? [{ href: destinations[user.role], label: "Acessar minha área", contained: true }]
    : [{ href: "/cadastro/aluno", label: "Sou pombinho", contained: true }, { href: "/cadastro/recrutador", label: "Sou recrutador", contained: false }];
  return <div ref={entrance} className="join-actions" data-motion-scope>{actions.map((action, index) =>
    <div key={action.href} data-entrance={0.8 + index * 0.1} data-hero-action>
      <motion.div whileHover={hover} transition={{ duration: 0.2 }}>
        <Button component={Link} href={action.href} variant={action.contained ? "contained" : "outlined"} endIcon={<ArrowForward />}>{action.label}</Button>
      </motion.div>
    </div>
  )}</div>;
}

function NetworkPanel({ company = false }: { company?: boolean }) {
  return <div className={`network-panel ${company ? "company-network" : ""}`} aria-hidden="true">
    <span className="panel-coordinate">RPV / {company ? "CONEXÕES" : "TRAJETÓRIAS"}</span>
    <ValleyScene compact />
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
  const policy = useLandingMotionPolicy();
  const reduced = policy === "pending" || policy === "reduced";
  const { user, loading } = useAuth();
  const { mode, systemMode, setMode } = useColorScheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("hero");
  const [audience, setAudience] = useState(0);
  const menuButton = useRef<HTMLButtonElement>(null);
  const dark = (mode === "system" ? systemMode : mode) !== "light";

  useEffect(() => {
    let elevated = false;
    const onScroll = () => {
      const next = window.scrollY > 24;
      if (next !== elevated) { elevated = next; setScrolled(next); }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: "-15% 0px -60% 0px" });
    navigation.forEach(([id]) => { const section = document.getElementById(id); if (section) observer.observe(section); });
    return () => { window.removeEventListener("scroll", onScroll); observer.disconnect(); };
  }, []);

  const steps = audience === 0 ? [
    ["Faça parte", "Solicite seu cadastro e dê o primeiro passo no ecossistema."],
    ["Construa seu perfil", "Apresente sua formação, competências, projetos e experiências."],
    ["Seja encontrado", "Deixe sua trajetória visível para recrutadores autorizados."],
  ] : [
    ["Faça parte", "Solicite seu acesso como recrutador ao ecossistema."],
    ["Encontre talentos", "Explore perfis por competências, formação e interesses."],
    ["Conecte-se", "Conheça a trajetória e entre em contato pelos canais do talento."],
  ];

  return <div className="landing" ref={entrance} data-motion-scope>
    <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
    <header className={`landing-header ${scrolled || menuOpen ? "is-elevated" : ""}`} onKeyDown={event => { if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); } }}>
      <div className="nav-inner" data-entrance="0.08">
        <Link href="#hero" className="brand-link" aria-label="Talent Valley — início" onClick={() => setMenuOpen(false)}><Brand /></Link>
        <nav id="public-navigation" aria-label="Navegação principal" className={`public-nav ${menuOpen ? "is-open" : ""}`}>
          {navigation.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => { setMenuOpen(false); document.getElementById(id)?.focus({ preventScroll: true }); }}>{label}</a>)}
        </nav>
        <div className="nav-actions">
          <motion.div className="theme-control" whileTap={reduced ? undefined : { scale: 0.96 }} transition={{ duration: 0.16 }}><LightModeOutlined aria-hidden="true"/><Switch className="theme-toggle" checked={!dark} onChange={(_, checked) => setMode(checked ? "light" : "dark")} slotProps={{ input: { "aria-label": "Tema claro" } }}/><DarkModeOutlined aria-hidden="true"/></motion.div>
          {loading ? <span className="identity-placeholder" aria-label="Verificando sessão"/> : user ? <Link className="user-link" href={destinations[user.role]} aria-label={`Acessar área de ${user.nome}`}><Avatar>{user.nome.trim().charAt(0)}</Avatar><span>{user.nome.split(" ")[0]}</span></Link> : <Button component={Link} className="login-button" href="/login" variant="outlined">Login</Button>}
          <IconButton ref={menuButton} className="menu-toggle" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <Close/> : <Menu/>}</IconButton>
        </div>
      </div>
    </header>

    <main id="conteudo" tabIndex={-1}>
      <section ref={hero} id="hero" tabIndex={-1} className="hero" aria-labelledby="hero-title">
        <div className="hero-background-scroll" aria-hidden="true"><div className="hero-background" data-entrance="0" data-entrance-fade /></div>
        <div className="hero-atmosphere" aria-hidden="true" data-entrance="0" data-entrance-fade />
        <div className="hero-topography" aria-hidden="true"><div className="hero-topography-depth"><svg viewBox="0 0 1440 680" preserveAspectRatio="xMidYMax slice" fill="none" data-entrance="1.15" data-entrance-fade><SceneContours compact /></svg></div></div>
        <div className="hero-network" aria-hidden="true"><div className="hero-network-depth"><svg viewBox="0 0 1440 680" preserveAspectRatio="xMidYMax slice" fill="none" data-entrance="1.3" data-entrance-fade><SceneConnections /></svg></div></div>
        <div className="hero-exit-shade" aria-hidden="true"/>
        <div data-entrance="1.2" data-entrance-fade className="hero-side hero-side-left" aria-hidden="true">PESSOAS<br/>CONEXÕES<br/>UM VALE MAIS FORTE<span/></div>
        <div data-entrance="1.2" data-entrance-fade className="hero-side hero-side-right" aria-hidden="true">DO NOSSO VALE<br/>PARA MAIS<br/>OPORTUNIDADES<span/></div>
        <div className="hero-copy"><div className="hero-copy-depth">
          <h1 id="hero-title"><span className="hero-title-line" data-entrance="0.16">Talento <span>encontra</span></span><br/><span className="hero-title-line" data-entrance="0.3"><em>oportunidade</em> aqui.</span></h1>
          <p className="hero-subtitle" data-entrance="0.48">Onde talentos e oportunidades se encontram.</p>
          <p className="institutional-line" data-entrance="0.62">Uma iniciativa Rio Pomba Valley</p>
          <JoinActions hero />
        </div></div>
        <a data-entrance="1.35" data-entrance-fade className="explore-link" href="#proposta"><span>role para explorar</span><KeyboardArrowDown fontSize="small"/></a>
        <div data-entrance="1.2" data-entrance-fade className="hero-side hero-side-bottom" aria-hidden="true">RIO POMBA VALLEY<br/>CONECTA<br/>PESSOAS E IDEIAS<span/></div>
        <div data-entrance="1.2" data-entrance-fade className="hero-side hero-side-middle" aria-hidden="true">TALENTOS<br/>MOVEM<br/>REGIÕES<span/></div>
        <div className="hero-institution" data-entrance="1.2" data-entrance-fade><Image src="/brand/rio-pomba-valley.png" width={291} height={244} alt="Rio Pomba Valley"/><span>TERRITÓRIO<br/>DE GRANDES<br/>PESSOAS</span></div>
      </section>

      <section id="proposta" className="section value-section" aria-labelledby="value-title">
        <div className="section-heading"><p className="eyebrow">UM ECOSSISTEMA DE POSSIBILIDADES</p><h2 id="value-title">Talento, formação e<br/>mercado <em>conectados.</em></h2></div>
        <div className="value-grid grid md:grid-cols-3">
          {[[VisibilityOutlined,"Visibilidade","Sua trajetória ganha espaço. Seu potencial chega a quem busca novos talentos."],[HubOutlined,"Conexão","Pessoas e empresas se aproximam por competências, interesses e possibilidades reais."],[LayersOutlined,"Ecossistema","Educação, tecnologia e mercado fortalecem juntos o futuro da nossa região."]].map(([Icon,title,copy]) => { const Symbol = Icon as typeof VisibilityOutlined; return <article key={String(title)}><Symbol aria-hidden="true"/><h3>{String(title)}</h3><p>{String(copy)}</p></article>; })}
        </div>
      </section>

      <section id="talentos" tabIndex={-1} className="section audience-section grid lg:grid-cols-2" aria-labelledby="talents-title">
        <div className="audience-copy"><p className="eyebrow">01 / PARA TALENTOS</p><h2 id="talents-title">Seu potencial<br/>merece ser <em>encontrado.</em></h2><p>Você tem uma história para construir. Crie seu perfil profissional, apresente sua formação, competências e trajetória e ganhe visibilidade no ecossistema Rio Pomba Valley.</p><ul className="benefits"><li><span>01</span>Monte seu perfil</li><li><span>02</span>Mostre sua trajetória</li><li><span>03</span>Seja encontrado</li></ul><JoinActions audience="talent"/></div>
        <NetworkPanel />
      </section>

      <section id="empresas" tabIndex={-1} className="section audience-section company-section grid lg:grid-cols-2" aria-labelledby="companies-title">
        <NetworkPanel company />
        <div className="audience-copy"><p className="eyebrow">02 / PARA RECRUTADORES</p><h2 id="companies-title">Encontre talento<br/>onde ele está <em>nascendo.</em></h2><p>O próximo talento da sua equipe pode estar mais perto do que você imagina. Conheça profissionais da região, explore competências e formação e descubra o potencial por trás de cada trajetória.</p><div className="company-note"><NorthEast aria-hidden="true"/><p>Conexões locais.<br/><strong>Possibilidades que vão além.</strong></p></div><JoinActions audience="company"/></div>
      </section>

      <section id="como-funciona" tabIndex={-1} className="how-section" aria-labelledby="how-title"><div className="section">
        <div className="section-heading"><p className="eyebrow">SIMPLES PARA COMEÇAR</p><h2 id="how-title">Seu próximo passo.<br/><em>Uma nova possibilidade.</em></h2></div>
        <Tabs className="audience-tabs" value={audience} onChange={(_, value: number) => setAudience(value)} centered aria-label="Como funciona para cada público"><Tab id="how-tab-0" aria-controls="how-panel-0" label="Para talentos"/><Tab id="how-tab-1" aria-controls="how-panel-1" label="Para empresas"/></Tabs>
        <div role="tabpanel" id={`how-panel-${audience}`} aria-labelledby={`how-tab-${audience}`} tabIndex={0}><ol className="steps-grid grid md:grid-cols-3">{steps.map(([title, copy], index) => <li key={title}><span className="step-number">0{index+1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></div>
      </div></section>

      <section id="rio-pomba-valley" tabIndex={-1} className="section institution-section" aria-labelledby="rpv-title">
        <div className="institution-brand"><Image src="/brand/rio-pomba-valley.png" width={291} height={244} alt="Rio Pomba Valley MG.BR — marca institucional original"/><span>ORIGEM LOCAL. VOCAÇÃO PARA O FUTURO.</span></div>
        <div><p className="eyebrow">NOSSA ORIGEM, NOSSA FORÇA</p><h2 id="rpv-title">Um vale de pessoas.<br/><em>Um mundo de potencial.</em></h2><p>O Rio Pomba Valley conecta pessoas, empresas, educação, tecnologia e inovação. Uma rede que valoriza o conhecimento da nossa região e abre caminhos para o seu desenvolvimento.</p><p>O Talent Valley nasce dessa conexão: um espaço para aproximar quem está construindo sua trajetória de quem acredita no seu potencial.</p><div className="ecosystem-words"><span>Pessoas</span><span>Educação</span><span>Empresas</span><span>Tecnologia</span><span>Inovação</span></div></div>
      </section>
    </main>
    <footer className="landing-footer"><div className="footer-main"><Link className="brand-link" href="#hero"><Brand/></Link><p>O próximo capítulo começa com uma conexão.</p><Link href={user ? destinations[user.role] : "/login"}>{user ? "Minha área" : "Login"}<NorthEast fontSize="small"/></Link></div><div className="footer-bottom"><span>Talent Valley · Uma iniciativa Rio Pomba Valley</span><span>Feito de pessoas. Conectado ao futuro.</span></div></footer>
  </div>;
}
