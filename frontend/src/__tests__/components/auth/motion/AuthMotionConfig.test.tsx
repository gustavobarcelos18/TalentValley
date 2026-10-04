import { useContext } from "react";
import { render, screen } from "@testing-library/react";
import { MotionConfigContext } from "framer-motion";
import { describe, expect, it } from "vitest";
import { AuthMotionConfig } from "@/components/auth/motion/AuthMotionConfig";

function ReducedMotionSetting() {
  return <p>{useContext(MotionConfigContext).reducedMotion}</p>;
}

describe("AuthMotionConfig", () => {
  it("renders its children", () => {
    render(
      <AuthMotionConfig>
        <span>conteudo</span>
      </AuthMotionConfig>,
    );
    expect(screen.getByText("conteudo")).toBeTruthy();
  });

  it("makes animations below it follow the user's reduced-motion preference", () => {
    render(
      <AuthMotionConfig>
        <ReducedMotionSetting />
      </AuthMotionConfig>,
    );
    expect(screen.getByText("user")).toBeTruthy();
  });
});
