export const generateToken = (): { token: string; hashed: string } => {
  const token = crypto.randomUUID();
  const hashed = new Bun.CryptoHasher("sha256", process.env.TOKEN_HASH_SECRET)
    .update(token)
    .digest("base64");
  return { token, hashed };
};
