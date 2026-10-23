/** The words of a Full Name, with extra whitespace ignored and letters composed (`S` + caron is `Š`). */
function nameWords(fullName: string): string[] {
  return fullName
    .normalize('NFC')
    .split(/\s+/)
    .filter((word) => word !== '');
}

/** The greeting's first name: the first word of Full Name (#62). */
export function firstName(fullName: string): string {
  return nameWords(fullName)[0] ?? '';
}

/**
 * Avatar initials: the first letter of the first and the last word, uppercase (#62).
 * One word gives one letter.
 */
export function initials(fullName: string): string {
  const words = nameWords(fullName);
  const ends = words.length > 1 ? [words[0], words.at(-1)] : words;
  return ends.map((word) => Array.from(word ?? '')[0]?.toUpperCase() ?? '').join('');
}
