"use client";

import React from "react";
import styles from "./booking.module.css";
import { Clock } from "lucide-react";

export interface Tier {
  id: number;
  durationMinutes: number;
  price: number;
  currency: string;
}

interface ServiceTierSelectorProps {
  tiers: Tier[];
  selectedTierId: number | null;
  onSelectTier: (tier: Tier) => void;
}

export const ServiceTierSelector: React.FC<ServiceTierSelectorProps> = ({
  tiers,
  selectedTierId,
  onSelectTier,
}) => {
  return (
    <div className={styles.tierGrid}>
      {tiers.map((tier) => {
        const isSelected = tier.id === selectedTierId;
        return (
          <button
            key={tier.id}
            type="button"
            className={`${styles.tierCard} ${isSelected ? styles.tierCardSelected : ""}`}
            onClick={() => onSelectTier(tier)}
            aria-pressed={isSelected}
            id={`tier-card-${tier.durationMinutes}m`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: isSelected ? "var(--accent-teal-glow)" : "var(--text-muted)", marginBottom: 4 }}>
              <Clock size={13} />
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                Duration
              </span>
            </div>
            <div className={styles.tierDuration}>{tier.durationMinutes} Mins</div>
            <div className={styles.tierPrice}>
              ${Number(tier.price).toFixed(2)}
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 2, fontWeight: 500 }}>
                {tier.currency}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
