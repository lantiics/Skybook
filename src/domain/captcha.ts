import { config } from "../config";
import { CaptchaFailedError } from "../errors";

/**
 * Validates a provided token against a captcha provider,
 * throwing if the token is invalid.
 * @param token The captcha token to validate
 */
export const assertCaptchaTokenValid = async (
  token: string,
): Promise<boolean> => {
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
  return success as boolean;
};
