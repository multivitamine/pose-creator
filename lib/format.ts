// Pure formatting helpers safe to import from both server and client components.

// Human label for a shot: its name if set, otherwise "Shot {number}".
export function shotLabel(shot: { name: string | null; number: number }): string {
  return shot.name?.trim() || `Shot ${shot.number}`;
}

// Derive a shot's name and number from an uploaded filename.
// "shot 6.jpg" -> { name: "shot 6", number: 6 }; "lookbook.png" -> { name: "lookbook", number: null }.
export function parseShotFromFilename(filename: string): { name: string | null; number: number | null } {
  const baseName = filename.replace(/\.[^.]+$/, '').trim();
  const match = baseName.match(/\d+/);
  const number = match ? parseInt(match[0], 10) : null;
  return { name: baseName || null, number };
}
