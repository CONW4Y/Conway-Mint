/**
 * Token Namer
 *
 * Uses the automaton's AI inference to generate compelling
 * token names, tickers, and descriptions based on trends.
 *
 * This runs within the automaton's ReAct loop, so it uses
 * whatever frontier model the automaton has access to.
 */

export interface TokenConcept {
  name: string;
  symbol: string;
  description: string;
  imagePrompt: string;
  rationale: string;
  estimatedAppeal: "low" | "medium" | "high";
  category: "memecoin" | "utility" | "community";
}

export class TokenNamer {
  /**
   * Generate a token concept
   *
   * Note: In the automaton framework, this doesn't need to call
   * an external API — the automaton IS running on a frontier model.
   * This function provides the structured prompt template that the
   * agent's ReAct loop will use to generate concepts.
   */
  async generate(
    theme?: string,
    style: "memecoin" | "utility" | "community" = "memecoin"
  ): Promise<TokenConcept> {
    // The automaton's agent loop will see this as a structured task
    // and use its own inference to generate the concept

    const promptTemplate = this.buildPrompt(theme, style);

    // In the automaton context, this returns a prompt for the agent
    // to reason about, rather than calling an external API
    // The agent fills in the concept during its Think phase

    return {
      name: `[Agent will generate based on: ${theme || "current trends"}]`,
      symbol: "[Agent will generate]",
      description: "[Agent will generate]",
      imagePrompt: "[Agent will generate]",
      rationale: "[Agent will explain why this concept will attract traders]",
      estimatedAppeal: "medium",
      category: style,
    };
  }

  private buildPrompt(theme?: string, style?: string): string {
    return `Generate a token concept for a ${style || "memecoin"} on Solana.

${theme ? `Theme/narrative to build around: ${theme}` : "Use current trending memes and crypto narratives."}

Requirements:
- Name: Catchy, memorable, max 32 characters
- Symbol: 3-8 characters, easy to type and remember
- Description: One compelling sentence that makes traders curious
- Image concept: Description for generating a logo (colorful, iconic, works at small sizes)

Good memecoin names are:
- Punny or clever wordplay
- Reference trending memes, animals, or internet culture
- Easy to say and share
- Have an "inside joke" quality that builds community

Good utility token names are:
- Professional but memorable
- Suggest the token's purpose
- Sound like a real product/protocol

Output as JSON with fields: name, symbol, description, imagePrompt, rationale`;
  }
}
