export interface BetInfo {
  amount: number;
  position: boolean; // true = agree, false = disagree
  isValid: boolean;
  error?: string;
}

export class BetParser {
  static parseBetFromTweet(text: string): BetInfo {
    const cleanText = text.toLowerCase().trim();

    // Extract amount patterns
    const amountPatterns = [
      /(\d+\.?\d*)\s*eth/i,
      /(\d+\.?\d*)\s*ether/i,
      /eth\s*(\d+\.?\d*)/i,
      /ether\s*(\d+\.?\d*)/i
    ];

    let amount = 0;
    for (const pattern of amountPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        amount = parseFloat(match[1]);
        break;
      }
    }

    if (amount === 0) {
      return {
        amount: 0,
        position: false,
        isValid: false,
        error: "No valid bet amount found. Use format like '0.1 ETH'"
      };
    }

    if (amount < 0.001) {
      return {
        amount,
        position: false,
        isValid: false,
        error: "Minimum bet amount is 0.001 ETH"
      };
    }

    if (amount > 10) {
      return {
        amount,
        position: false,
        isValid: false,
        error: "Maximum bet amount is 10 ETH"
      };
    }

    // Determine position (agree vs disagree)
    const agreeWords = ['true', 'agree', 'yes', 'correct', 'right', 'will happen', 'believe'];
    const disagreeWords = ['false', 'disagree', 'no', 'wrong', 'incorrect', 'wont happen', 'doubt'];

    let position = false; // default to disagree
    let foundPosition = false;

    // Check for agree words
    for (const word of agreeWords) {
      if (cleanText.includes(word)) {
        position = true;
        foundPosition = true;
        break;
      }
    }

    // Check for disagree words (only if no agree word found)
    if (!foundPosition) {
      for (const word of disagreeWords) {
        if (cleanText.includes(word)) {
          position = false;
          foundPosition = true;
          break;
        }
      }
    }

    if (!foundPosition) {
      return {
        amount,
        position: false,
        isValid: false,
        error: "Position unclear. Please specify 'agree/true' or 'disagree/false'"
      };
    }

    return {
      amount,
      position,
      isValid: true
    };
  }

  static formatPosition(position: boolean): string {
    return position ? '✅ AGREE' : '❌ DISAGREE';
  }

  static generateBetSummary(betInfo: BetInfo): string {
    if (!betInfo.isValid) {
      return `❌ Invalid bet: ${betInfo.error}`;
    }

    return `💰 ${betInfo.amount} ETH - ${this.formatPosition(betInfo.position)}`;
  }
} 