"use client";

import { Fragment } from "react";
import { Box } from "@mui/material";
import { motion } from "framer-motion";
import { maskReveal, stagger } from "./variants";

export interface TextSegment {
  text: string;
  /** Painted with the primary color. */
  accent?: boolean;
}

interface SplitTextProps {
  segments: TextSegment[];
  /** Seconds before the first word starts. */
  delay?: number;
  /** Seconds between two words. */
  step?: number;
  /** Called once every word is in place. */
  onComplete?: () => void;
}

// A word is a run of non-space characters, which can span segments ("segurança" + ".").
function toWords(segments: TextSegment[]) {
  const words: TextSegment[][] = [];
  let startNewWord = true;

  for (const segment of segments) {
    for (const token of segment.text.match(/\S+|\s+/g) ?? []) {
      if (/^\s/.test(token)) {
        startNewWord = true;
        continue;
      }
      if (startNewWord) words.push([]);
      words[words.length - 1].push({ text: token, accent: segment.accent });
      startNewWord = false;
    }
  }

  return words;
}

/** Text that enters word by word, each word sliding up from behind its own clipping box. */
export function SplitText({ segments, delay = 0, step = 0.06, onComplete }: SplitTextProps) {
  const words = toWords(segments);

  return (
    <motion.span variants={stagger(step, delay)} initial="hidden" animate="visible" onAnimationComplete={onComplete}>
      {words.map((parts, index) => (
        <Fragment key={index}>
          {index > 0 && " "}
          {/* The padding keeps descenders inside the clip; the negative margin cancels its height. */}
          <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.12em", marginBottom: "-0.12em" }}>
            <motion.span variants={maskReveal} style={{ display: "inline-block" }}>
              {parts.map((part, partIndex) => (
                <Box key={partIndex} component="span" sx={part.accent ? { color: "primary.main" } : undefined}>
                  {part.text}
                </Box>
              ))}
            </motion.span>
          </span>
        </Fragment>
      ))}
    </motion.span>
  );
}
