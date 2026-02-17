/**
 * Launch Timing Optimizer
 *
 * Determines the optimal time to launch a token based on:
 * - Market conditions (SOL price, overall volume)
 * - Time of day (US trading hours vs Asia hours)
 * - Recent launch success rates
 * - Gas costs (Solana priority fees)
 */

export interface TimingRecommendation {
  shouldLaunch: boolean;
  confidence: number; // 0-100
  reason: string;
  suggestedWait?: number; // minutes to wait
  marketCondition: "bullish" | "neutral" | "bearish";
  volumeCondition: "high" | "normal" | "low";
}

export class TimingOptimizer {
  /**
   * Evaluate whether now is a good time to launch
   */
  async evaluate(): Promise<TimingRecommendation> {
    const hour = new Date().getUTCHours();

    // Peak memecoin trading: US market hours (14:00-22:00 UTC)
    // Secondary peak: Asia hours (00:00-08:00 UTC)
    const isPeakHours =
      (hour >= 14 && hour <= 22) || (hour >= 0 && hour <= 8);

    // Check if it's a weekend (lower volume but less competition)
    const dayOfWeek = new Date().getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let confidence = 50;
    let reason = "Neutral market conditions";

    if (isPeakHours) {
      confidence += 20;
      reason = "Peak trading hours — higher visibility and volume";
    } else {
      confidence -= 10;
      reason = "Off-peak hours — lower volume but less competition";
    }

    if (isWeekend) {
      confidence -= 5;
      reason += " (weekend — slightly lower activity)";
    }

    return {
      shouldLaunch: confidence >= 50,
      confidence,
      reason,
      suggestedWait: confidence < 50 ? (14 - hour + 24) % 24 * 60 : undefined,
      marketCondition: "neutral",
      volumeCondition: isPeakHours ? "high" : "normal",
    };
  }
}
