import { config } from "../config";
import { CaptchaFailedError } from "../errors";

export const assertCaptchaTokenValid = async (token: string) => {
  if (!config.captcha.enabled) return true;
  const { success } = (await (
    await fetch(config.captcha.verification_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.CAPTCHA_SECRET,
        response: token,
      }),
    })
  ).json()) as Record<string, unknown>;

  if (!success) throw new CaptchaFailedError("Failed to pass captcha");
  return success;
};
