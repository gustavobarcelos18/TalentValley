import { TalentValleyMark } from "@/components/brand/TalentValleyMark";

/** Institutional mark shared by the public header and the footer. */
export function Brand() {
  return <span className="tv-brand"><TalentValleyMark /><span><strong>Talent <em>Valley</em></strong><small>by Rio Pomba Valley</small></span></span>;
}
