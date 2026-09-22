import { WRITER } from "@/db";

export const withSignupDisabled = async (f: any) => {
  await WRITER`UPDATE service_settings SET value=false WHERE name='signup_enabled'`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE service_settings SET value=true WHERE name='signup_enabled'`;
  }
};

export const withLoginDisabled = async (f: any) => {
  await WRITER`UPDATE service_settings SET value=false WHERE name='login_enabled'`;
  try {
    return await f();
  } finally {
    await WRITER`UPDATE service_settings SET value=true WHERE name='login_enabled'`;
  }
};
