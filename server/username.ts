/** Username rules: letters+digits only, no spaces/symbols, length 3–16, no swear/blocked words. */

const BLOCKED = new Set(
  [
    'admin',
    'administrator',
    'mod',
    'moderator',
    'nigger',
    'nigga',
    'faggot',
    'fag',
    'retard',
    'rape',
    'rapist',
    'pedo',
    'pedophile',
    'hitler',
    'nazi',
    'fuck',
    'fucker',
    'fucking',
    'shit',
    'asshole',
    'bitch',
    'cunt',
    'dick',
    'cock',
    'pussy',
    'whore',
    'slut',
    'bastard',
    'motherfucker',
    'cum',
    'porn',
    'sex',
    'xxx',
    'kill',
    'suicide',
    'terrorist',
  ].map((w) => w.toLowerCase())
);

export function sanitizeSteamUsername(persona: string): string {
  const cleaned = persona.replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  if (cleaned.length >= 3 && !validateUsername(cleaned).ok) {
    return `Slicer${cleaned.slice(0, 8) || Date.now().toString(36).slice(-4)}`;
  }
  if (cleaned.length >= 3) return cleaned;
  return `Slicer${Date.now().toString(36).slice(-6)}`;
}

export function validateUsername(raw: string): { ok: true; username: string } | { ok: false; error: string } {
  const username = raw.trim();
  if (!username) return { ok: false, error: 'Username is required.' };
  if (/\s/.test(username)) return { ok: false, error: 'Username cannot contain spaces.' };
  if (!/^[A-Za-z0-9]+$/.test(username)) {
    return { ok: false, error: 'Username can only use letters and numbers (no symbols).' };
  }
  if (username.length < 3 || username.length > 16) {
    return { ok: false, error: 'Username must be 3–16 characters.' };
  }
  const lower = username.toLowerCase();
  for (const word of BLOCKED) {
    if (lower === word || lower.includes(word)) {
      return { ok: false, error: 'That username is not allowed. Pick another.' };
    }
  }
  return { ok: true, username };
}
