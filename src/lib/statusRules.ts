export interface StatusRule {
  key: string;
  label: string;
  theme: "Red" | "Orange" | "Blue" | "Purple" | "Grey" | "Yellow";
  durationDays: number | null; // null represents unlimited / indefinite
  blockLogin: boolean;
  blockRequests: boolean;
  blockChat: boolean;
  blockPayments: boolean;
  hideProfile: boolean;
}

export const STATUS_THEMES = {
  Red: { bg: "rgba(232, 64, 64, 0.10)", color: "#E84040", border: "rgba(232, 64, 64, 0.20)" },
  Orange: { bg: "rgba(245, 166, 35, 0.10)", color: "#F5A623", border: "rgba(245, 166, 35, 0.20)" },
  Blue: { bg: "rgba(43, 110, 232, 0.10)", color: "#2B6EE8", border: "rgba(43, 110, 232, 0.20)" },
  Purple: { bg: "rgba(155, 89, 182, 0.10)", color: "#9B59B6", border: "rgba(155, 89, 182, 0.20)" },
  Grey: { bg: "rgba(148, 163, 184, 0.10)", color: "#64748B", border: "rgba(148, 163, 184, 0.20)" },
  Yellow: { bg: "rgba(234, 179, 8, 0.10)", color: "#EAB308", border: "rgba(234, 179, 8, 0.20)" },
};

export const DEFAULT_STATUS_RULES: StatusRule[] = [
  {
    key: "quarantined",
    label: "Quarentena",
    theme: "Orange",
    durationDays: 15,
    blockLogin: false,
    blockRequests: true,
    blockChat: true,
    blockPayments: true,
    hideProfile: true,
  },
  {
    key: "disabled",
    label: "Desativado",
    theme: "Red",
    durationDays: null,
    blockLogin: true,
    blockRequests: true,
    blockChat: true,
    blockPayments: true,
    hideProfile: true,
  },
];

export function getStatusRules(): StatusRule[] {
  const saved = localStorage.getItem("ubt_status_rules");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error reading ubt_status_rules from localStorage:", e);
    }
  }
  // Initialize in localStorage if not set yet
  saveStatusRules(DEFAULT_STATUS_RULES);
  return DEFAULT_STATUS_RULES;
}

export function saveStatusRules(rules: StatusRule[]): void {
  localStorage.setItem("ubt_status_rules", JSON.stringify(rules));
}
