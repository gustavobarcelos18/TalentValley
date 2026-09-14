import type { MeResponse } from "@/types/student";

// Props shared by every student profile section.
export interface SectionProps {
  profile: MeResponse;
  onChanged: () => void;
  notify: (message: string) => void;
}
