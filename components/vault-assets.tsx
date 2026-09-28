"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Coins,
  Users,
} from "lucide-react";
import type { Balance, State } from "@/lib/domain";
import { SHORT } from "@/lib/domain";
import { assetKey, mainnetCatalog } from "@/lib/assets";

export function AssetMark({
  asset,
}: {
  asset: { code: string; issuer: string };
}) {
  return (
    <span className="asset-mark" aria-hidden="true">
      {asset.issuer ? asset.code.slice(0, 2) : <Coins size={23} />}
    </span>
  );
}

export function VaultAssets({
  data,
  es,
  onSend,
  onReceive,
  onDetails,
  onCatalog,
}: {
  data: State;
  es: boolean;
  onSend: (asset: Balance) => void;
  onReceive: (asset: Balance) => void;
  onDetails: (asset: Balance) => void;
  onCatalog: () => void;
}) {
  const t = (a: string, b: string) => (es ? a : b);
  const format = (amount: string) =>
    new Intl.NumberFormat(es ? "es-ES" : "en-US", {
      maximumFractionDigits: 7,
    }).format(Number(amount));
  const pending = data.payments.some((p) =>
    ["pending", "submitting"].includes(p.status),
  );
  return (
    <section
      className="section vault-assets"
      aria-label={t("Monedas de la bóveda", "Vault currencies")}
    >
      <div className="section-heading">
        <div>
          <h2>{t("Monedas", "Currencies")}</h2>
          <p>
            {t(
              "El mismo saldo para todo el equipo.",
              "The same balance for the whole team.",
            )}
          </p>
        </div>
        <button className="secondary" onClick={onCatalog}>
          {t("Ver catálogo", "View catalog")}
          <ChevronRight size={16} />
        </button>
      </div>
      {data.chainError ? (
        <div className="empty-row" role="status">
          {t(
            "No pudimos verificar los saldos. Actualiza para continuar.",
            "We could not verify balances. Refresh to continue.",
          )}
        </div>
      ) : data.balances.length ? (
        <>
          <div className="assets-columns" aria-hidden="true">
            <span>{t("Moneda", "Currency")}</span>
            <span>{t("Saldo", "Balance")}</span>
            <span>{t("Disponible para enviar", "Available to send")}</span>
            <span />
          </div>
          {data.balances.map((asset) => (
            <article
              className="asset-row"
              key={assetKey(asset)}
              aria-label={`${asset.code}${asset.issuer ? ` · ${SHORT(asset.issuer)}` : ""}`}
            >
              <button
                className="asset-identity"
                onClick={() => onDetails(asset)}
                aria-label={t(
                  `Ver detalles de ${asset.code}`,
                  `View ${asset.code} details`,
                )}
              >
                <AssetMark asset={asset} />
                <span>
                  <strong>
                    {asset.code}
                    <ChevronRight size={14} />
                  </strong>
                  <small>
                    {asset.issuer
                      ? `${t("Emisor", "Issuer")} · ${SHORT(asset.issuer)}`
                      : "Stellar Lumens"}
                  </small>
                </span>
              </button>
              <div className="asset-amount">
                <small className="asset-mobile-label">
                  {t("Saldo", "Balance")}
                </small>
                <strong>{format(asset.balance)}</strong>
                <small>{asset.code}</small>
              </div>
              <div className="asset-amount">
                <small className="asset-mobile-label">
                  {t("Disponible", "Available")}
                </small>
                <strong>{format(asset.available)}</strong>
                <small>
                  {!asset.authorized
                    ? t(
                        "Requiere autorización del emisor",
                        "Issuer authorization required",
                      )
                    : Number(asset.pending) > 0
                      ? t(
                          `${format(asset.pending)} por aprobar`,
                          `${format(asset.pending)} awaiting approval`,
                        )
                      : !asset.issuer
                        ? t(
                            `${format(asset.reserve)} XLM de reserva`,
                            `${format(asset.reserve)} XLM reserve`,
                          )
                        : t("Habilitada en la bóveda", "Enabled in the vault")}
                </small>
              </div>
              <div className="asset-actions">
                <button
                  className="secondary"
                  aria-label={t(`Enviar ${asset.code}`, `Send ${asset.code}`)}
                  disabled={
                    pending ||
                    !asset.authorized ||
                    Number(asset.available) <= 0 ||
                    data.vault?.status !== "active"
                  }
                  onClick={() => onSend(asset)}
                >
                  <ArrowUpRight size={17} />
                  <span>{t("Enviar", "Send")}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label={t(
                    `Recibir ${asset.code}`,
                    `Receive ${asset.code}`,
                  )}
                  disabled={
                    !asset.authorized || data.vault?.status !== "active"
                  }
                  onClick={() => onReceive(asset)}
                >
                  <ArrowDownLeft size={18} />
                </button>
              </div>
            </article>
          ))}
          <p className="assets-note">
            <Users size={16} />
            {t(
              "Los importes disponibles descuentan reservas, compromisos y la comisión prevista.",
              "Available amounts account for reserves, commitments and the expected fee.",
            )}
          </p>
        </>
      ) : (
        <div className="empty-row">
          <Coins size={24} />
          <p>
            {data.vault?.status === "active"
              ? t(
                  "Todavía no hay monedas para mostrar.",
                  "No currencies to display yet.",
                )
              : t(
                  "Al activar la bóveda, aquí aparecerán sus monedas y saldos de Stellar.",
                  "Once activated, this vault’s currencies and Stellar balances will appear here.",
                )}
          </p>
        </div>
      )}
      <div className="planned-assets">
        <span>{t("Previstas para mainnet", "Planned for mainnet")}</span>
        <div>
          {mainnetCatalog.map((asset) => (
            <button key={assetKey(asset)} onClick={onCatalog}>
              {asset.code}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
        <small>{t("Integración pendiente", "Integration pending")}</small>
      </div>
    </section>
  );
}
