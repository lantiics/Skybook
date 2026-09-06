import { JwtSymmetricAlgorithmNotAllowed } from "hono/utils/jwt/types";
import raw from "../config.toml";

const config = raw as {
  kaiju: {
    version: string;
    proxies_between: number | boolean;
  };
  server: {
    captcha: "cloudflare" | "cap";
    captcha_token_property_name: string;
  };
  captcha: {
    implementation: "cap" | "cloudflare";
    token_property_name: string;
    site_key: string;
    secret_key: string;
    challenge_url: string;
    verification_url: string;
  };

  filter: {
    derogatory: boolean;
  };
  fields: {
    typical_max_length: number;
    author_max_length: number;
  };
  rate_limits: {
    auth_window_ms: number;
    auth_limit: number;
    entry_creation_window_ms: number;
    entry_creation_limit_anonymous: number;
    entry_creation_limit_elevated: number;
    alteration_window_ms: number;
    alteration_limit_elevated: number;
    alteration_limit_anonymous: number;

    fetch_window_ms: number;
    fetch_limit: number;
  };
  sessions: { expiry_days: number };
  tokens: { expiry_hours: number };
  jobs: { expiration_sweep_interval_minutes: number };
  ip_blocking: {
    global_block_threshold: number;
    automated_enforcements_enabled: boolean;
    proxy_addresses_blocked: boolean;
    vpn_addresses_blocked: boolean;
    tor_addresses_blocked: boolean;
  };

  is_production: boolean;
};
config.is_production = process.env.NODE_ENV === "production";
export { config };
