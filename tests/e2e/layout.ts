/** Shared layout checks for the E2E suites (see mobile-layout.spec.ts for the rules). */
import type { Page } from "@playwright/test";

export async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const describe = (el: Element) => {
      const r = el.getBoundingClientRect();
      const text = (el.textContent || el.getAttribute("name") || el.getAttribute("aria-label") || "").trim().slice(0, 30);
      return `<${el.tagName.toLowerCase()}> "${text}" ${Math.round(r.width)}x${Math.round(r.height)} at x=${Math.round(r.left)}`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      // Skip screen-reader-only text and deliberately hidden elements (e.g. the anti-bot honeypot).
      return r.width > 0 && r.height > 0 && !el.closest(".sr-only") && !el.closest('[aria-hidden="true"]');
    };

    const overflow = [...document.querySelectorAll("body *")]
      .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1)
      .filter((el) => !el.closest("[class*='overflow-x-auto']"))
      .map(describe);

    const controls = "header a, header button, nav a, footer a, button, select, summary, input:not([type=hidden]):not([type=checkbox]):not([type=radio])";
    const smallTargets = [...document.querySelectorAll(controls)]
      .filter(visible)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height < 43.5 || r.width < 43.5;
      })
      .map(describe);

    const smallText = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]), select, textarea")]
      .filter(visible)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map(describe);

    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewport: vw,
      overflow: overflow.slice(0, 5),
      smallTargets: smallTargets.slice(0, 5),
      smallText: smallText.slice(0, 5),
    };
  });
}
