import { config } from "../config";
import { CaptchaFailedError } from "../errors";

export const assertCaptchaTokenValid = async (token: string) => {
  const { success } = await (
    await fetch(config.captcha.verification_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: config.captcha.secret_key,
        response: token,
      }),
    })
  ).json();
  if (!success) throw new CaptchaFailedError("Failed to pass captcha");
  return success;
};
