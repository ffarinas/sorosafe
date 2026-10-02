"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Dialog } from "radix-ui";
import {
  ArrowLeft,
  ArrowRight,
  BookUser,
  Check,
  Compass,
  Globe2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { positionTour, spotlightRect, type TourRect } from "./geometry";
import {
  tourLabels,
  type TourIcon,
  type TourLanguage,
  type TourStep,
} from "./types";

const icons = {
  vault: LockKeyhole,
  wallet: Wallet,
  team: Users,
  send: Send,
  book: BookUser,
  check: ShieldCheck,
  globe: Globe2,
  guide: Compass,
} satisfies Record<TourIcon, typeof Compass>;

export default function ProductTour({
  steps,
  language,
  onClose,
  onStepChange,
}: {
  steps: TourStep[];
  language: TourLanguage;
  onClose: () => void;
  onStepChange?: (step: TourStep) => void;
}) {
  const [index, setIndex] = useState(0);
  const [geometry, setGeometry] = useState<{
    target: TourRect | null;
    width: number;
    height: number;
    cardHeight: number;
  }>({ target: null, width: 0, height: 0, cardHeight: 320 });
  const cardRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const step = steps[index];
  const labels = tourLabels[language];
  const last = index === steps.length - 1;

  useEffect(() => {
    // The portal starts hidden until measured. Focus after it becomes visible.
    if (geometry.width && cardRef.current && !focused.current) {
      cardRef.current.focus({ preventScroll: true });
      focused.current = true;
    }
  }, [geometry.width]);

  useEffect(() => {
    if (step) onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    if (!step) return;
    let frame = 0;
    let scrolled: HTMLElement | null = null;
    const measure = () => {
      const element = document.querySelector<HTMLElement>(
        `[data-product-tour="${step.target}"]`,
      );
      const viewport = {
        width: document.documentElement.clientWidth,
        height: window.innerHeight,
      };
      if (element && element !== scrolled) {
        // Only scroll the real page; never click a financial action for a tour.
        element.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "instant",
        });
        scrolled = element;
      }
      const rect = element?.getBoundingClientRect();
      const target =
        rect && rect.width > 0 && rect.height > 0
          ? spotlightRect(rect, viewport)
          : null;
      const next = {
        target,
        ...viewport,
        cardHeight: cardRef.current?.getBoundingClientRect().height || 320,
      };
      setGeometry((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const resize = new ResizeObserver(schedule);
    if (cardRef.current) resize.observe(cardRef.current);
    const mutations = new MutationObserver(schedule);
    // Section switches and data arriving can mount the target after this effect.
    mutations.observe(document.querySelector("main") || document.body, {
      subtree: true,
      childList: true,
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [step]);

  if (!step) return null;
  const width = Math.min(380, Math.max(0, geometry.width - 32));
  const position = positionTour(
    geometry.target,
    { width: geometry.width, height: geometry.height },
    { width, height: geometry.cardHeight },
    step.placement,
  );
  const Icon = icons[step.icon];
  const next = () =>
    last ? onClose() : setIndex((n) => Math.min(n + 1, steps.length - 1));
  const arrow = position.placement
    ? ({
        "--tour-arrow-offset": `${position.arrowOffset}px`,
      } as CSSProperties)
    : undefined;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={`product-tour-overlay${geometry.target ? " has-spotlight" : ""}`}
        >
          {geometry.target && (
            <div
              className="product-tour-spotlight"
              style={{ ...geometry.target }}
            />
          )}
        </Dialog.Overlay>
        <Dialog.Content
          ref={cardRef}
          className="product-tour-card"
          lang={language}
          style={{
            top: position.top,
            left: position.left,
            width: width || "calc(100vw - 32px)",
            visibility: geometry.width ? "visible" : "hidden",
            ...arrow,
          }}
          data-placement={position.placement}
          data-tour-step={step.id}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document
              .querySelector<HTMLButtonElement>(
                '[data-product-tour="tour-launcher"]',
              )
              ?.focus();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              next();
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setIndex((n) => Math.max(0, n - 1));
            }
          }}
        >
          <div className="product-tour-scroll">
            <div className="product-tour-top">
              <span className="product-tour-icon">
                <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="product-tour-eyebrow">{labels.guide}</span>
              <Dialog.Close
                className="product-tour-close"
                aria-label={labels.close}
              >
                <X size={19} />
              </Dialog.Close>
            </div>
            <div aria-live="polite" aria-atomic="true">
              <Dialog.Title className="product-tour-title">
                {step.title}
              </Dialog.Title>
              <Dialog.Description className="product-tour-body">
                {step.body}
              </Dialog.Description>
              {step.note && <p className="product-tour-note">{step.note}</p>}
            </div>
          </div>
          <div className="product-tour-bottom">
            <div
              className="product-tour-progress"
              role="progressbar"
              aria-label={labels.guide}
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={index + 1}
              aria-valuetext={`${labels.step} ${index + 1} ${labels.of} ${steps.length}`}
            >
              {steps.map((s, i) => (
                <span key={s.id} className={i <= index ? "is-done" : ""} />
              ))}
            </div>
            <div className="product-tour-controls">
              <span className="product-tour-counter">
                {String(index + 1).padStart(2, "0")}{" "}
                <span>/ {String(steps.length).padStart(2, "0")}</span>
              </span>
              <button
                className="product-tour-back"
                disabled={index === 0}
                onClick={() => setIndex((n) => Math.max(0, n - 1))}
                aria-label={labels.back}
              >
                <ArrowLeft size={18} />
              </button>
              <button className="product-tour-next" onClick={next}>
                {last ? labels.finish : labels.next}
                <span>
                  {last ? <Check size={16} /> : <ArrowRight size={16} />}
                </span>
              </button>
            </div>
            <button className="product-tour-skip" onClick={onClose}>
              {labels.skip}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
