/**
 * SMS behind an interface. No provider is connected yet (brief: implement
 * later with a Philippine SMS provider). The stub sends nothing and says so.
 */
import "server-only";

export interface SmsProvider {
  send(toE164: string, text: string): Promise<boolean>;
}

export const smsProvider: SmsProvider = {
  async send() {
    return false; // not configured: callers fall back to email
  },
};
