"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLandingMotionPolicy } from "./LandingMotion";

const steps = [
  [
    ["Faça parte", "Solicite seu cadastro e dê o primeiro passo no ecossistema."],
    ["Construa seu perfil", "Apresente sua formação, competências, projetos e experiências."],
    ["Seja encontrado", "Deixe sua trajetória visível para recrutadores autorizados."],
  ],
  [
    ["Faça parte", "Solicite seu acesso como recrutador ao ecossistema."],
    ["Encontre talentos", "Explore perfis por competências, formação e interesses."],
    ["Conecte-se", "Conheça a trajetória e entre em contato pelos canais do talento."],
  ],
];

export function StorySteps({ audience }: { audience: number }) {
  const policy = useLandingMotionPolicy();
  const simple = policy === "pending" || policy === "reduced";
  const mobile = policy === "mobile";
  return <div className="story-steps">
    {/* Both intrinsic sizes reserve the larger panel at every width/font size. */}
    {steps.map((group, index) => <ol key={index} className="steps-grid steps-measure grid md:grid-cols-3" aria-hidden="true" inert>
      {group.map(([title, copy], index) => <li key={title}><span className="step-number">0{index + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}
    </ol>)}
    <div className="steps-content" role="tabpanel" id={`how-panel-${audience}`} aria-labelledby={`how-tab-${audience}`} tabIndex={0}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.ol key={`${audience}-${policy}`} className="steps-grid grid md:grid-cols-3"
          initial={simple ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: 0.15 }}
          exit={{ opacity: 0, transition: { duration: simple ? 0.1 : 0.12 } }}
          variants={{ hidden: { opacity: 1 }, visible: { opacity: 1, transition: { staggerChildren: simple ? 0 : mobile ? 0.08 : 0.2 } } }}>
          {steps[audience].map(([title, copy], index) => <motion.li key={title}
            variants={{ hidden: { opacity: 0, y: mobile ? 6 : 12 }, visible: { opacity: 1, y: 0, transition: { duration: simple ? 0.12 : 0.45 } } }}>
            <span className="step-number">0{index + 1}<motion.span aria-hidden="true" className="step-connection"
              variants={{ hidden: { scaleX: 0 }, visible: { scaleX: 1, transition: { duration: simple ? 0 : 0.5 } } }}/></span>
            <h3>{title}</h3><p>{copy}</p>
          </motion.li>)}
        </motion.ol>
      </AnimatePresence>
    </div>
  </div>;
}
