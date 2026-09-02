import raw from "../config.toml";

const config = raw as {
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
    proxy_addresses_blocked: boolean;
    vpn_addresses_blocked: boolean;
    tor_addresses_blocked: boolean;
  };
  is_production: boolean;
};
config.is_production = process.env.NODE_ENV === "production";
export { config };
