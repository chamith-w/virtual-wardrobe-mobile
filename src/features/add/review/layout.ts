/** Where the review stage sits, shared with the saved screen so the fly-in starts from it. Pure. */
export function reviewStageFrame(screenWidth: number, screenHeight: number, topInset: number) {
  const width = screenWidth - 48;
  const height = Math.min(screenHeight * 0.49, width * 1.25);
  // Header (44) below the inset, then 12 of breathing room.
  return { x: 24, y: topInset + 4 + 44 + 12, width, height };
}
