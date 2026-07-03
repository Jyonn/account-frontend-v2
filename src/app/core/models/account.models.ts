export interface LegacyEnvelope<T> {
  identifier: string;
  user_message?: string;
  body: T;
}

export interface UserProfile {
  user_str_id: string;
  nickname?: string;
  description?: string;
  birthday?: string;
  avatar?: string | { link?: string | null } | null;
  qitian?: string;
  allow_qitian_modify?: boolean;
  verify_status?: number;
  verify_type?: number;
  is_dev?: boolean;
}

export interface AccountApp {
  app_id: string;
  app_name: string;
  app_desc?: string;
  app_info?: string;
  logo?: string | { link?: string | null } | null;
  redirect_uri?: string;
  test_redirect_uri?: string;
  user_num?: number;
  create_time?: number;
  app_secret?: string;
  scopes?: ChoiceItem[];
  premises?: ChoiceItem[];
  relation?: {
    belong?: boolean;
    bind?: boolean;
    mark?: number;
    rebind?: boolean;
    user_app_id?: string;
  };
}

export interface CaptchaFlowResult {
  next_mode: 5 | 6 | 7;
  toast_msg: string;
}

export interface AuthPayload {
  token: string;
  user: UserProfile;
}

export interface QitianCheckPayload {
  exists: boolean;
  qitian: string;
}

export interface OAuthPayload {
  auth_code: string;
  redirect_uri: string;
}

export interface ChoiceItem {
  id: string;
  key: string;
  detail?: string;
  always?: boolean | null;
  selected?: boolean;
}

export interface UploadTokenPayload {
  key: string;
  upload_token: string;
}
