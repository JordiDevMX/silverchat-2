export async function generateBackupCodes() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const codes = new Set<string>();
  while (codes.size < 10) {
    let code = "";
    while (code.length < 10) {
      const values = crypto.getRandomValues(new Uint8Array(16));
      for (const value of values) {
        if (value < 252 && code.length < 10) code += alphabet[value % 36];
      }
    }
    codes.add(code);
  }
  const plain = [...codes];
  const hashes = await Promise.all(
    plain.map(async (code) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }),
  );
  return { codes: plain, hashes };
}
