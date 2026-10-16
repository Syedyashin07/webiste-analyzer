export type HealthBand = "EXCELLENT" | "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";

export function healthBand(score: number): HealthBand {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "HEALTHY";
  if (score >= 50) return "NEEDS_ATTENTION";
  return "CRITICAL";
}

export function healthBandLabel(score: number | null | undefined): string {
  if (score == null) return "No score yet";
  switch (healthBand(score)) {
    case "EXCELLENT":
      return "Excellent";
    case "HEALTHY":
      return "Healthy";
    case "NEEDS_ATTENTION":
      return "Needs attention";
    default:
      return "Critical";
  }
}

export function healthBandTone(score: number | null | undefined): "green" | "teal" | "amber" | "red" | "slate" {
  if (score == null) return "slate";
  switch (healthBand(score)) {
    case "EXCELLENT":
      return "green";
    case "HEALTHY":
      return "teal";
    case "NEEDS_ATTENTION":
      return "amber";
    default:
      return "red";
  }
}

export function healthStroke(score: number | null | undefined): string {
  if (score == null) return "#A89480";
  switch (healthBand(score)) {
    case "EXCELLENT":
      return "#059669";
    case "HEALTHY":
      return "#BF5700";
    case "NEEDS_ATTENTION":
      return "#d97706";
    default:
      return "#b91c1c";
  }
}
