"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, IconButton, useColorScheme } from "@mui/material";
import { Close, DarkModeOutlined, LightModeOutlined, Menu } from "@mui/icons-material";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Brand } from "./Brand";
import { destinations, navigation } from "./navigation";
import { useLandingMotionPolicy } from "./motion/LandingMotion";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useMyPhoto } from "@/hooks/useMyPhoto";

/** Viewport line that decides which navigation item is active. */
const activeLine = 120;

/** Public header; owns its scroll state so the landing content never rerenders while scrolling. */
export function PublicHeader() {
  const { user } = useAuth();
  const { photoPath, reloadKey } = useMyPhoto();
  const { mode, systemMode, setMode } = useColorScheme();
  const policy = useLandingMotionPolicy();
  const reduced = policy === "pending" || policy === "reduced";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("hero");
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
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = navigation.map(([id]) => document.getElementById(id)).filter((section): section is HTMLElement => section !== null);
    if (!sections.length) return;
    const visible = new Set<string>();
    let observer: IntersectionObserver | null = null;
    // The lowest section that owns the active line wins, matching the navigation order.
    const onEntries: IntersectionObserverCallback = entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      setActive(navigation.reduce((id, [sectionId]) => visible.has(sectionId) ? sectionId : id, "hero"));
    };
    // A one-pixel observation band on the active line: the browser reports the section that owns it,
    // so scrolling never measures layout.
    const observe = () => {
      observer?.disconnect();
      visible.clear();
      const next = new IntersectionObserver(onEntries, { rootMargin: `-${activeLine}px 0px ${activeLine + 1 - window.innerHeight}px 0px` });
      sections.forEach(section => next.observe(section));
      observer = next;
    };
    observe();
    window.addEventListener("resize", observe, { passive: true });
    return () => { observer?.disconnect(); window.removeEventListener("resize", observe); };
  }, []);

  return <header className={`landing-header ${scrolled || menuOpen ? "is-elevated" : ""}`} onKeyDown={event => { if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); } }}>
      <div className="nav-inner" data-entrance="0.08">
        <Link href="#hero" className="brand-link" aria-label="Talent Valley — início" onClick={() => setMenuOpen(false)}><Brand /></Link>
        <nav id="public-navigation" aria-label="Navegação principal" className={`public-nav ${menuOpen ? "is-open" : ""}`}>
          {navigation.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => setMenuOpen(false)}>{label}</a>)}
        </nav>
        <div className="nav-actions">
          <motion.div className="theme-control" whileTap={reduced ? undefined : { scale: 0.96 }} transition={{ duration: 0.16 }}><IconButton className="theme-toggle-button" aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"} onClick={() => setMode(dark ? "light" : "dark")}>{dark ? <LightModeOutlined aria-hidden="true"/> : <DarkModeOutlined aria-hidden="true"/>}</IconButton></motion.div>
          {user ? <Link className="user-link" href={destinations[user.role]} aria-label={`Acessar área de ${user.nome}`}><UserAvatar key={`${user.id}-${reloadKey}`} name={user.nome} photoPath={photoPath} reloadKey={reloadKey} size={32} /><span>{user.nome.split(" ")[0]}</span></Link> : <Button component={Link} className="login-button" href="/login" variant="outlined">Login</Button>}
          <IconButton ref={menuButton} className="menu-toggle" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <Close/> : <Menu/>}</IconButton>
        </div>
      </div>
    </header>
}
