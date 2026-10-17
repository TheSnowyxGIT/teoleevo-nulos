export function createShuffleCycle(
  presetIds: string[],
  avoidFirstId?: string,
  random: () => number = Math.random,
): string[] {
  const shuffled = [...new Set(presetIds)];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }

  if (shuffled.length > 1 && shuffled[0] === avoidFirstId) {
    const replacementIndex = shuffled.findIndex(id => id !== avoidFirstId);
    if (replacementIndex > 0) {
      [shuffled[0], shuffled[replacementIndex]] = [
        shuffled[replacementIndex]!,
        shuffled[0]!,
      ];
    }
  }
  return shuffled;
}
