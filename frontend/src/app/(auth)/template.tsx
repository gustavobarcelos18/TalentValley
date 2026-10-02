"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { duration, ease } from "@/components/auth/motion/tokens";
import { useMotionPolicy } from "@/components/auth/motion/useMotionPolicy";

// How deep each entry screen sits in the flow, so moving to a deeper one slides in "forward"
// and moving to a shallower one slides in "back".
const FLOW_DEPTH: Record<string, number> = {
  "/login": 0,
  "/cadastro": 1,
  "/esqueci-senha": 1,
  "/reenviar-ativacao": 1,
  "/redefinir-senha": 2,
  "/ativar-conta": 2,
};

// Depth of the screen shown before this one. Set only in an effect, so it stays undefined on the
// server and during hydration, and is cleared when the user leaves the (auth) screens.
let previousDepth: number | undefined;

// The template remounts on every navigation between entry screens, so the old screen is already
// gone when this one mounts: the new content enters (short slide + fade) but there is no exit.
export default function AuthTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const policy = useMotionPolicy();
  const depth = FLOW_DEPTH["/" + pathname.split("/")[1]] ?? 0;

  const direction = previousDepth === undefined ? 0 : depth >= previousDepth ? 1 : -1;
  const distance = policy === "pointer" ? 28 : policy === "touch" ? 14 : 0;

  useEffect(() => {
    previousDepth = depth;
    return () => {
      previousDepth = undefined;
    };
  }, [depth]);

  return (
    <motion.div
      initial={direction === 0 ? false : { opacity: 0, x: direction * distance }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: duration.base, ease: ease.outExpo }}
    >
      {children}
    </motion.div>
  );
}
