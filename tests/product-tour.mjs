import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

// Test the actual positioning and copy builders, without browser or wallet mocks.
const result = await build({
  stdin: {
    contents:
      'export * from "./components/product-tour/geometry"; export * from "./components/product-tour/content";',
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const { positionTour, spotlightRect, introSteps, vaultSteps, setupSteps } =
  await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );

const config = {
  language: "en",
  threshold: 3,
  signers: 7,
  currencies: ["XLM", "USDC"],
  feeBps: 37,
  sharedContacts: true,
};
const step = (steps, id) => steps.find((s) => s.id === id);

test("the explanation follows the actual quorum, currency list and fee", () => {
  for (const language of ["es", "en"]) {
    const steps = vaultSteps({ ...config, language });
    assert.match(step(steps, "rules").body, /3 .*7 /);
    assert.match(step(steps, "funds").body, /XLM, USDC/);
    assert.doesNotMatch(step(steps, "funds").body, /USDT/);
    assert.match(
      step(steps, "fees").body,
      language === "es" ? /0,37 %/ : /0\.37%/,
    );
    assert.match(
      step(steps, "operations").body,
      language === "es" ? /Ejecutar/ : /Execute/,
    );
    assert.match(
      step(steps, "payment").note,
      language === "es" ? /primera aprobación/ : /first approval/,
    );
  }
});

test("one approval can execute immediately, even with several eligible signers", () => {
  for (const language of ["es", "en"]) {
    for (const signers of [1, 5]) {
      const steps = vaultSteps({ ...config, language, threshold: 1, signers });
      assert.match(
        step(steps, "rules").body,
        language === "es" ? /Una sola persona/ : /One person/,
      );
      assert.match(
        step(steps, "payment").note,
        language === "es"
          ? /envía el pago al proponerlo/
          : /sends the payment when you propose/,
      );
      assert.doesNotMatch(step(steps, "operations").body, /Execute|Ejecutar/);
    }
  }
});

test("invitation and direct-contract entry do not promise a new vault or shared metadata", () => {
  for (const language of ["es", "en"]) {
    const invite = introSteps(language, true, true);
    assert.match(
      step(invite, "create").body,
      language === "es"
        ? /no necesitas crear otra/
        : /don't need to create another/,
    );
    const direct = vaultSteps({ ...config, language, sharedContacts: false });
    assert.match(
      step(direct, "contacts").body,
      language === "es"
        ? /directamente desde su dirección/
        : /directly by its address/,
    );
    assert.notEqual(
      step(direct, "contacts").body,
      step(vaultSteps({ ...config, language }), "contacts").body,
    );
  }
});

test("network instructions distinguish real money from Testnet", () => {
  for (const language of ["es", "en"]) {
    const main = step(introSteps(language, false, false), "network").body;
    const testnet = step(introSteps(language, false, true), "network").body;
    assert.match(main, /Mainnet/);
    assert.doesNotMatch(main, /Testnet/);
    assert.match(testnet, /Testnet/);
    assert.match(
      testnet,
      language === "es" ? /no tienen valor real/ : /no real value/,
    );
  }
});

test("both languages cover every step and retain the same navigation targets", () => {
  for (const factory of [
    (language) => introSteps(language, false, true),
    (language) => introSteps(language, true, false),
    (language) => vaultSteps({ ...config, language }),
    setupSteps,
  ]) {
    const es = factory("es"),
      en = factory("en");
    assert.equal(new Set(es.map((s) => s.id)).size, es.length);
    assert.deepEqual(
      es.map((s) => [s.id, s.target, s.section]),
      en.map((s) => [s.id, s.target, s.section]),
    );
    for (let i = 0; i < es.length; i++) {
      assert.notEqual(es[i].title, en[i].title);
      assert.notEqual(es[i].body, en[i].body);
      assert.ok(es[i].body && en[i].body);
    }
  }
});

test("cards stay inside mobile, landscape and desktop viewports at every edge", () => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    const card = {
      width: Math.min(380, viewport.width - 32),
      height: Math.min(430, viewport.height - 32),
    };
    for (const rect of [
      { top: -30, left: -20, width: 200, height: 80 },
      { top: 30, left: viewport.width - 75, width: 100, height: 40 },
      { top: viewport.height - 40, left: 50, width: 300, height: 180 },
      { top: 50, left: 16, width: viewport.width, height: viewport.height },
    ]) {
      const target = spotlightRect(rect, viewport);
      assert.ok(target.left >= 8 && target.top >= 8);
      assert.ok(target.left + target.width <= viewport.width - 8);
      assert.ok(target.top + target.height <= viewport.height - 8);
      for (const side of ["left", "right", "top", "bottom"]) {
        const position = positionTour(target, viewport, card, side);
        assert.ok(position.left >= 16 && position.top >= 16);
        assert.ok(position.left + card.width <= viewport.width - 16);
        assert.ok(position.top + card.height <= viewport.height - 16);
        if (position.placement) {
          assert.ok(
            position.top + card.height <= target.top ||
              position.top >= target.top + target.height ||
              position.left + card.width <= target.left ||
              position.left >= target.left + target.width,
            "An arrow must not point at a target covered by the card",
          );
        }
      }
    }
  }
});

test("missing targets have a centered readable fallback without a misleading arrow", () => {
  assert.deepEqual(
    positionTour(
      null,
      { width: 1000, height: 800 },
      { width: 380, height: 400 },
    ),
    { left: 310, top: 200 },
  );
  const position = positionTour(
    { top: 8, left: 8, width: 374, height: 828 },
    { width: 390, height: 844 },
    { width: 358, height: 400 },
  );
  assert.equal(position.placement, undefined);
  assert.equal(position.top, 428);
});
