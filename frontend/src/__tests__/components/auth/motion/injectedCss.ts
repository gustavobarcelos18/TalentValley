/** Every CSS rule emotion has injected into the document so far. */
export function injectedCss() {
  return Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");
}

/** The injected rules that target the element's emotion class, including theme-scheme variants. */
export function rulesOf(element: Element) {
  const className = Array.from(element.classList).find((name) => name.startsWith("css-")) ?? "";
  return injectedCss()
    .split("\n")
    .filter((rule) => rule.includes(`.${className}`))
    .join("\n");
}
