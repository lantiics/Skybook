export interface RequestContext {
  readonly instance: string;
  readonly elevated: boolean; // Instance administrators
  readonly superAdmin: boolean; //
  readonly authenticated: boolean;
  readonly identifier?: string;
  readonly token?: string;
  readonly user?: {
    name: string;
    identifier: string;
    mfaEnabled: boolean;
  };
  readonly superadmin?: boolean;
  readonly ip: string;
}
