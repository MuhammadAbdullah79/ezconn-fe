// ─── Meta WhatsApp Embedded Signup helpers ──────────────────────────────
//
// Meta's WhatsApp Embedded Signup is exposed as an `FB.login(...)` call
// configured with the app's Embedded Signup `config_id`. These helpers are
// used by the self-hosted signup launcher (`WhatsAppSignupLauncherPage`,
// routes `/coexistence` + `/whatsapp`) which mirrors replyagent's external
// "metaconnect" service: it runs the FB dialog then redirects back to the
// onboard return page with the result in the URL hash.

let _fbSdkPromise: Promise<void> | null = null;

/**
 * Load + init the Facebook JS SDK once. Memoises the in-flight promise so
 * repeat calls resolve immediately.
 */
export function loadFacebookSdk(appId: string, version: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).FB) return Promise.resolve();
  if (_fbSdkPromise) return _fbSdkPromise;

  _fbSdkPromise = new Promise<void>((resolve, reject) => {
    (window as any).fbAsyncInit = () => {
      try {
        (window as any).FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version,
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    const id = "facebook-jssdk";
    if (document.getElementById(id)) return; // script already injected
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.onerror = () => reject(new Error("Failed to load Facebook SDK."));
    document.body.appendChild(s);
  });
  return _fbSdkPromise;
}

export interface EmbeddedSignupResult {
  code: string;
  waba_id?: string;
  phone_number_id?: string;
  business_id?: string;
  user_id?: string;
}

/**
 * Calls `FB.login` with WhatsApp Embedded Signup options and resolves with
 * the combined OAuth code + WABA metadata once Meta posts the
 * `WA_EMBEDDED_SIGNUP` FINISH event. Rejects with `code: 'USER_CANCELLED'`
 * if the user closes the popup.
 *
 * `coex = true` adds `featureType: 'whatsapp_business_app_onboarding'` so Meta
 * shows the "Connect a WhatsApp Business App" (Coexistence) option; the
 * standard Cloud/Business API flow omits it. Same `config_id` powers both.
 */
export function launchEmbeddedSignup(configId: string, coex = false): Promise<EmbeddedSignupResult> {
  return new Promise((resolve, reject) => {
    const FB = (window as any).FB;
    if (!FB) {
      reject(new Error("Facebook SDK is not initialised."));
      return;
    }

    let signupData: Partial<EmbeddedSignupResult> = {};
    let cancelled = false;

    const onMessage = (event: MessageEvent) => {
      // Meta posts from `https://www.facebook.com` (or regional variants).
      if (typeof event.origin !== "string" || !/^https:\/\/([a-z-]+\.)?facebook\.com$/.test(event.origin)) {
        return;
      }
      try {
        const parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (parsed?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (parsed.event === "FINISH") {
          signupData = {
            ...signupData,
            waba_id: parsed.data?.waba_id,
            phone_number_id: parsed.data?.phone_number_id,
            business_id: parsed.data?.business_id,
            user_id: parsed.data?.user_id,
          };
        } else if (parsed.event === "CANCEL") {
          cancelled = true;
        }
      } catch {
        // Non-JSON or unrelated message — ignore.
      }
    };
    window.addEventListener("message", onMessage);

    FB.login(
      (response: any) => {
        window.removeEventListener("message", onMessage);
        if (cancelled) {
          const err: any = new Error("User cancelled the sign-up.");
          err.code = "USER_CANCELLED";
          reject(err);
          return;
        }
        const code = response?.authResponse?.code;
        if (!code) {
          const err: any = new Error("Meta did not return an authorisation code.");
          err.code = "NO_CODE";
          reject(err);
          return;
        }
        resolve({ code, ...signupData });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          feature: "whatsapp_embedded_signup",
          sessionInfoVersion: 3,
          // Coexistence flow: `featureType` makes Meta show the "Connect a
          // WhatsApp Business App" option (onboard a number already live on the
          // WhatsApp Business app). The standard Cloud/Business API flow omits
          // it, so that option is hidden. Same config_id powers both.
          ...(coex ? { featureType: "whatsapp_business_app_onboarding" } : {}),
        },
      },
    );
  });
}
