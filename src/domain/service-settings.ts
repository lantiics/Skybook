import { READER, WRITER } from "../db.ts";

const _getSpecifiedServiceStatus = async (status: string): Promise<boolean> => {
  const [res] =
    await READER`SELECT value FROM service_settings WHERE name = ${status};`;
  return res.value;
};
const _toggleSpecifiedServiceStatus = async (status: string): Promise<void> => {
  await WRITER`UPDATE service_settings SET value = NOT value WHERE name = ${status}`;
};

export const signupEnabled = async (): Promise<boolean> => {
  return await _getSpecifiedServiceStatus("signup_enabled");
};

export const toggleSignup = async (): Promise<void> => {
  await _toggleSpecifiedServiceStatus("signup_enabled");
};

export const signupInvitationRequired = async (): Promise<boolean> => {
  return await _getSpecifiedServiceStatus("signup_requires_invitation");
};

export const toggleSignupRequiresInvitation = async (): Promise<void> => {
  await _toggleSpecifiedServiceStatus("signup_requires_invitation");
};

export const loginEnabled = async (): Promise<boolean> => {
  return await _getSpecifiedServiceStatus("login_enabled");
};

export const toggleLogin = async (): Promise<void> => {
  await _toggleSpecifiedServiceStatus("login_enabled");
};
