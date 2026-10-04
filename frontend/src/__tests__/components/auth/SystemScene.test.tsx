import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemScene, type SystemSceneKind } from "@/components/auth/SystemScene";

function renderScene(kind: SystemSceneKind) {
  const { container } = render(<SystemScene kind={kind} />);
  return container.firstElementChild as HTMLElement;
}

function count(root: HTMLElement, selector: string) {
  return root.querySelectorAll(selector).length;
}

describe("SystemScene", () => {
  it.each<SystemSceneKind>(["lost", "locked", "failed"])("is a decorative illustration for the %s state", (kind) => {
    const root = renderScene(kind);

    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.textContent).toBe("");
  });

  it("draws the lost node drifting away from the network for the 404", () => {
    const root = renderScene("lost");

    expect(count(root, "svg line.sc-link")).toBe(6);
    expect(root.querySelector("svg line[stroke-dasharray]")).not.toBeNull();
    expect(count(root, ".sc-node")).toBe(5);
    expect(count(root, ".sc-arm")).toBe(1);
    expect(count(root, ".sc-lock")).toBe(0);
    expect(count(root, ".sc-broken")).toBe(0);
  });

  it("draws a padlock hanging from the network for the 403", () => {
    const root = renderScene("locked");

    expect(count(root, "svg line.sc-link")).toBe(4);
    expect(count(root, ".sc-node")).toBe(5);
    expect(count(root, ".sc-lock")).toBe(1);
    expect(count(root, ".sc-lock-body")).toBe(1);
    expect(count(root, ".sc-link-solid")).toBe(1);
    expect(count(root, ".sc-arm")).toBe(0);
  });

  it("draws the failing middle node and the dropped link for the error state", () => {
    const root = renderScene("failed");

    expect(root.querySelector("svg")).toBeNull();
    expect(count(root, ".sc-node")).toBe(2);
    expect(count(root, ".sc-broken")).toBe(2);
    expect(count(root, ".sc-link-solid")).toBe(1);
    expect(count(root, ".sc-lock")).toBe(0);
    expect(count(root, ".sc-arm")).toBe(0);
  });

  it("has a fixed size", () => {
    const style = getComputedStyle(renderScene("lost"));

    expect(style.width).toBe("180px");
    expect(style.height).toBe("110px");
  });
});
