export interface ReCaptchaApi {
  render(
    container: HTMLElement | string,
    parameters: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      theme?: 'light' | 'dark';
    }
  ): number;
  reset(optWidgetId?: number | string): void;
}

declare global {
  interface Window {
    grecaptcha?: ReCaptchaApi;
    onAccountRecaptchaLoaded?: () => void;
  }
}
