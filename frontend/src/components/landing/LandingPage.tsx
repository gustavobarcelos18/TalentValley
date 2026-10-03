import Link from "next/link";
import Image from "next/image";
import { KeyboardArrowDown, NorthEast, VisibilityOutlined, HubOutlined, LayersOutlined } from "@mui/icons-material";
import { ValleyScene, SceneContours, SceneConnections } from "./ValleyScene";
import { ProductPreview } from "./ProductPreview";
import { PublicHeader } from "./PublicHeader";
import { Brand } from "./Brand";
import { LandingRoot } from "./LandingRoot";
import { HeroActions, JoinActions, FooterAccessLink } from "./LandingActions";
import { HowItWorks } from "./HowItWorks";
import { entrance } from "./entrance";
import "./landing.css";

/** Server-rendered content; only the header, the CTAs, the audience tabs and the MUI leaves of the previews hydrate. */
export function LandingPage() {
  return <LandingRoot>
    <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
    <PublicHeader />

    <main id="conteudo" tabIndex={-1}>
      <section id="hero" tabIndex={-1} className="hero" aria-labelledby="hero-title">
        <div className="hero-background-scroll" aria-hidden="true"><div className="hero-background" /></div>
        <div className="hero-atmosphere" aria-hidden="true"><div className="hero-glow" /></div>
        <div className="hero-technology" aria-hidden="true"><div className="hero-technology-depth"><svg className="entrance entrance-fade" style={entrance(1.15)} viewBox="0 0 1440 680" preserveAspectRatio="xMidYMax slice" fill="none"><SceneContours compact /><SceneConnections /></svg></div></div>
        <div className="hero-exit-shade" aria-hidden="true"/>
        <div className="hero-copy"><div className="hero-copy-depth">
          <div className="hero-headline-scroll"><h1 id="hero-title"><span className="hero-title-line entrance" style={entrance(0.16)}>Talento <span>encontra</span></span><br/><span className="hero-title-line entrance" style={entrance(0.3)}><em>oportunidade</em> aqui.</span></h1></div>
          <div className="hero-subtitle-scroll"><p className="hero-subtitle entrance" style={entrance(0.48)}>Onde talentos e oportunidades se encontram.</p></div>
          <div className="hero-institutional-scroll"><p className="institutional-line entrance" style={entrance(0.62)}>Uma iniciativa Rio Pomba Valley</p></div>
          <div className="hero-actions-scroll"><HeroActions /></div>
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
        <div className="audience-copy"><p className="eyebrow">01 / PARA TALENTOS</p><h2 id="talents-title">Seu potencial<br/>merece ser <em>encontrado.</em></h2><p>Você tem uma história para construir. Crie seu perfil profissional, apresente sua formação, competências e trajetória e ganhe visibilidade no ecossistema Rio Pomba Valley.</p><div className="story-action"><JoinActions audience="talent"/></div></div>
        <ProductPreview audience="talent"/>
      </section>

      <section data-story="company" id="empresas" tabIndex={-1} className="section audience-section company-section grid lg:grid-cols-2" aria-labelledby="companies-title"><span className="story-continuity" aria-hidden="true"/>
        <ProductPreview audience="company"/>
        <div className="audience-copy"><p className="eyebrow">02 / PARA RECRUTADORES</p><h2 id="companies-title">Encontre talento<br/>onde ele está <em>nascendo.</em></h2><p>O próximo talento da sua equipe pode estar mais perto do que você imagina. Conheça profissionais da região, explore competências e formação e descubra o potencial por trás de cada trajetória.</p><div className="company-note"><NorthEast aria-hidden="true"/><p>Conexões locais.<br/><strong>Possibilidades que vão além.</strong></p></div><div className="story-action"><JoinActions audience="company"/></div></div>
      </section>

      <section data-story="how" id="como-funciona" tabIndex={-1} className="how-section" aria-labelledby="how-title"><span className="story-continuity" aria-hidden="true"/><div className="section">
        <div className="section-heading"><p className="eyebrow">SIMPLES PARA COMEÇAR</p><h2 id="how-title">Seu próximo passo.<br/><em>Uma nova possibilidade.</em></h2></div>
        <HowItWorks />
      </div></section>

      <section data-story="institution" id="rio-pomba-valley" tabIndex={-1} className="section institution-section" aria-labelledby="rpv-title"><span className="story-continuity" aria-hidden="true"/>
        <div className="institution-scene" aria-hidden="true"><ValleyScene compact /></div><div className="institution-brand"><Image src="/brand/rio-pomba-valley.png" width={291} height={244} alt="Rio Pomba Valley MG.BR — marca institucional original"/><span>ORIGEM LOCAL. VOCAÇÃO PARA O FUTURO.</span></div>
        <div className="institution-copy"><p className="eyebrow">NOSSA ORIGEM, NOSSA FORÇA</p><h2 id="rpv-title">Um vale de pessoas.<br/><em>Um mundo de potencial.</em></h2><p>O Rio Pomba Valley conecta pessoas, empresas, educação, tecnologia e inovação. Uma rede que valoriza o conhecimento da nossa região e abre caminhos para o seu desenvolvimento.</p><p>O Talent Valley nasce dessa conexão: um espaço para aproximar quem está construindo sua trajetória de quem acredita no seu potencial.</p><div className="ecosystem-words"><span>Pessoas</span><span>Educação</span><span>Empresas</span><span>Tecnologia</span><span>Inovação</span></div></div>
      </section>
    </main>
    <footer className="landing-footer"><div className="footer-main"><Link className="brand-link" href="#hero"><Brand/></Link><p>O próximo capítulo começa com uma conexão.</p><FooterAccessLink /></div><div className="footer-bottom"><span>Talent Valley · Uma iniciativa Rio Pomba Valley</span><span>Feito de pessoas. Conectado ao futuro.</span></div></footer>
  </LandingRoot>;
}
