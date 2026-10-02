export type TourLanguage = "es" | "en";
export type TourPlacement = "top" | "right" | "bottom" | "left";
export type TourSection = "funds" | "activity" | "contacts" | "team";
export type TourIcon =
  "vault" | "wallet" | "team" | "send" | "book" | "check" | "globe" | "guide";

export type TourStep = {
  id: string;
  target: string;
  title: string;
  body: string;
  note?: string;
  icon: TourIcon;
  placement?: TourPlacement;
  section?: TourSection;
};

export const tourLabels = {
  es: {
    launch: "Cómo funciona",
    guide: "Tu guía de SoroSafe",
    skip: "Salir del tour",
    back: "Atrás",
    next: "Siguiente",
    finish: "Entendido",
    of: "de",
    step: "Paso",
    close: "Cerrar recorrido",
  },
  en: {
    launch: "How it works",
    guide: "Your SoroSafe guide",
    skip: "Leave tour",
    back: "Back",
    next: "Next",
    finish: "Got it",
    of: "of",
    step: "Step",
    close: "Close tour",
  },
} satisfies Record<TourLanguage, Record<string, string>>;
