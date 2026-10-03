"use client";

import { useState } from "react";
import { Tab, Tabs } from "@mui/material";
import { StorySteps } from "./motion/StorySteps";

/** Audience tabs and their steps: the only interactive part of the "how it works" section. */
export function HowItWorks() {
  const [audience, setAudience] = useState(0);
  return <>
    <Tabs className="audience-tabs" value={audience} onChange={(_, value: number) => setAudience(value)} centered aria-label="Como funciona para cada público"><Tab id="how-tab-0" aria-controls="how-panel" label="Para talentos"/><Tab id="how-tab-1" aria-controls="how-panel" label="Para empresas"/></Tabs>
    <StorySteps audience={audience}/>
  </>;
}
