const sentenceEnd = /[.!?](?:["'*)\]]+)?$/;

export function completeRoast(text: string, fallback: string): string {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  const words = normalizedText.split(" ");
  const limitedText = words.slice(0, 300).join(" ");

  if (words.length <= 300 && sentenceEnd.test(limitedText)) {
    return limitedText;
  }

  const lastSentenceEnd = Math.max(
    limitedText.lastIndexOf("."),
    limitedText.lastIndexOf("!"),
    limitedText.lastIndexOf("?")
  );

  return lastSentenceEnd >= 0
    ? limitedText.slice(0, lastSentenceEnd + 1).trim()
    : fallback;
}
