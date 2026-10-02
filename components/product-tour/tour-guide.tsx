"use client";

import { lazy, Suspense, useMemo } from "react";
import { Compass } from "lucide-react";
import { introSteps, setupSteps, vaultSteps } from "./content";
import { useProductTour } from "./use-product-tour";
import { tourLabels, type TourLanguage, type TourStep } from "./types";
import "./tour.css";

const ProductTour = lazy(() => import("./product-tour"));

function TourGuide({
  id,
  account,
  enabled = true,
  autoStart = false,
  language,
  steps,
  onStepChange,
  onStart,
}: {
  id: string;
  account?: string;
  enabled?: boolean;
  autoStart?: boolean;
  language: TourLanguage;
  steps: TourStep[];
  onStepChange?: (step: TourStep) => void;
  onStart?: () => void;
}) {
  const tour = useProductTour({ id, account, enabled, autoStart });
  return (
    <>
      <button
        type="button"
        className="tour-launcher"
        data-product-tour="tour-launcher"
        disabled={!enabled}
        onClick={() => {
          onStart?.();
          tour.start();
        }}
        aria-haspopup="dialog"
      >
        <Compass size={17} strokeWidth={1.5} aria-hidden="true" />
        {tourLabels[language].launch}
      </button>
      {tour.open && (
        <Suspense fallback={null}>
          <ProductTour
            steps={steps}
            language={language}
            onClose={tour.close}
            onStepChange={onStepChange}
          />
        </Suspense>
      )}
    </>
  );
}

export function IntroTour({
  es,
  joining,
  testnet,
  blocked,
}: {
  es: boolean;
  joining: boolean;
  testnet: boolean;
  blocked: boolean;
}) {
  const language = es ? "es" : "en";
  const steps = useMemo(
    () => introSteps(language, joining, testnet),
    [language, joining, testnet],
  );
  return (
    <TourGuide
      id={joining ? "invitation" : "welcome"}
      language={language}
      steps={steps}
      enabled={!blocked}
    />
  );
}

export function SetupTour({
  es,
  account,
  network,
  blocked,
  onStart,
}: {
  es: boolean;
  account?: string;
  network: string;
  blocked: boolean;
  onStart: () => void;
}) {
  const language = es ? "es" : "en";
  const steps = useMemo(() => setupSteps(language), [language]);
  return (
    <TourGuide
      id={`setup:${network}`}
      account={account}
      language={language}
      steps={steps}
      enabled={!blocked}
      onStart={onStart}
    />
  );
}

export function VaultTour({
  es,
  account,
  network,
  ready,
  threshold,
  signers,
  currencies,
  feeBps,
  sharedContacts,
  onStepChange,
}: {
  es: boolean;
  account?: string;
  network: string;
  ready: boolean;
  threshold: number;
  signers: number;
  currencies: string[];
  feeBps: number;
  sharedContacts: boolean;
  onStepChange: (step: TourStep) => void;
}) {
  const language = es ? "es" : "en";
  // Stable across balance polling: updating real amounts must not restart steps.
  const currencyKey = currencies.join(",");
  const steps = useMemo(
    () =>
      vaultSteps({
        language,
        threshold,
        signers,
        currencies: currencyKey.split(","),
        feeBps,
        sharedContacts,
      }),
    [language, threshold, signers, currencyKey, feeBps, sharedContacts],
  );
  return (
    <TourGuide
      id={`vault:${network}`}
      account={account}
      language={language}
      steps={steps}
      enabled={ready}
      autoStart
      onStepChange={onStepChange}
    />
  );
}
