import raw from "../config.toml";
import pkg from "root/package.json";

const config = raw as {
  skybook: {
    version: string;
    proxies_between: number | boolean;
    subdomain_vanity: boolean;
    domain: string;
    header: string;
    user_enforcements_enabled: boolean;
    invitation_required: boolean;
    username_max_length: number;
    username_min_length: number;
  };
  caching: {
    purging: boolean;
    purge_endpoint: string;
  };
  instances: {
    max_global_filter_length: number;
  };

  captcha: {
    implementation: "cap" | "cloudflare";
    token_property_name: string;
    site_key: string;
    challenge_url: string;
    verification_url: string;
  };
  users: {
    indefinite_locking_threshold: number;
    expiration_threshold_days: number;
    expiration_grace_period_days: number;
  };
  posts: {
    perPage: number;
  };

  filter: {
    derogatory: boolean;
  };
  fields: {
    max_filter_length: number;
    name_max_length: number;
    max_count: number;
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
  jobs: {
    expiration_sweep_interval_minutes: number;
    lift_enforcements_interval_minutes: number;
  };
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

const version = pkg.version;
config.skybook.version = version;
export { config };
