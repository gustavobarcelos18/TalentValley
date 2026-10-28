import { screen } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import { describe, expect, it } from "vitest";
import { PrivacyNotice } from "@/components/profile/PrivacyNotice";

describe("PrivacyNotice", () => {
  it("says the profile is private and only approved recruiters see it", () => {
    render(<PrivacyNotice />);

    expect(screen.getByText("Perfil privado: só recrutadores aprovados veem.")).toBeTruthy();
  });
});
