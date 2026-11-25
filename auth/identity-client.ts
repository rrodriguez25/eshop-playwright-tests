import { test, type APIRequest, type APIRequestContext, type APIResponse } from '@playwright/test';

export type Credentials = { username: string; password: string };

/** Cookies and origins of a logged-in session, as `storageState` takes them. */
export type SessionState = Awaited<ReturnType<APIRequestContext['storageState']>>;

export type LoginStep = 'open login form' | 'submit credentials' | 'complete sign-in';

export class LoginError extends Error {
  constructor(
    readonly username: string,
    readonly step: LoginStep,
    detail: string,
  ) {
    super(`Login as ${username} failed at ${step}: ${detail}`);
    this.name = 'LoginError';
  }
}

/** The web app page that starts the login. eShop: `src/WebApp/Components/Pages/User/LogIn.razor`. */
const WEB_LOGIN_PATH = '/user/login';

/**
 * Identity's login form. eShop: `src/Identity.API/Views/Account/Login.cshtml` and
 * `src/Identity.API/Quickstart/Account/LoginInputModel.cs`.
 */
const LOGIN_FORM = {
  username: 'Username',
  password: 'Password',
  rememberLogin: 'RememberLogin',
  returnUrl: 'ReturnUrl',
  antiforgeryToken: '__RequestVerificationToken',
  button: 'button',
  loginButtonValue: 'login',
} as const;

/** A field of the form Identity returns after a successful login, posted on to the web app. */
const AUTHORIZATION_CODE_FIELD = 'code';

type LoginForm = { url: string; returnUrl: string; antiforgeryToken: string };
type SignInForm = { action: string; fields: Record<string, string> };

/**
 * Logs users in to eShop's web app over HTTP, without a browser, by running Identity's
 * authorization-code flow the way a browser would. Each login uses its own request context, so
 * one user's Identity cookie never logs in the next user.
 */
export class IdentityClient {
  constructor(
    private readonly request: APIRequest,
    private readonly webBaseUrl: string,
  ) {}

  /** Logs the user in and returns the session, ready to pass to a browser as `storageState`. */
  async logIn(credentials: Credentials): Promise<SessionState> {
    const { username } = credentials;
    return test.step(`Log in as ${username} over HTTP`, async () => {
      const context = await this.request.newContext({ ignoreHTTPSErrors: true });
      try {
        const loginForm = await this.openLoginForm(context, username);
        const signInForm = await this.submitCredentials(context, loginForm, credentials);
        await this.completeSignIn(context, signInForm, username);
        return await context.storageState();
      } finally {
        await context.dispose();
      }
    });
  }

  /** Opens the web app's login page, which redirects to Identity's login form. */
  private async openLoginForm(context: APIRequestContext, username: string): Promise<LoginForm> {
    const url = new URL(WEB_LOGIN_PATH, this.webBaseUrl).toString();
    const response = await context.get(url);
    const fields = readInputs(await response.text());
    const returnUrl = fields[LOGIN_FORM.returnUrl];
    const antiforgeryToken = fields[LOGIN_FORM.antiforgeryToken];
    if (!response.ok() || returnUrl === undefined || antiforgeryToken === undefined) {
      throw new LoginError(username, 'open login form',
        `${describe('GET', url, response)} did not show Identity's login form`);
    }
    return { url: withoutQuery(response.url()), returnUrl, antiforgeryToken };
  }

  /** Posts the credentials. On success Identity answers with a form that carries the code onward. */
  private async submitCredentials(
    context: APIRequestContext,
    loginForm: LoginForm,
    { username, password }: Credentials,
  ): Promise<SignInForm> {
    const response = await context.post(loginForm.url, {
      form: {
        [LOGIN_FORM.username]: username,
        [LOGIN_FORM.password]: password,
        [LOGIN_FORM.rememberLogin]: 'false',
        [LOGIN_FORM.returnUrl]: loginForm.returnUrl,
        [LOGIN_FORM.antiforgeryToken]: loginForm.antiforgeryToken,
        [LOGIN_FORM.button]: LOGIN_FORM.loginButtonValue,
      },
    });
    const html = await response.text();
    const action = readFormAction(html);
    const fields = readInputs(html);
    if (!response.ok() || action === undefined || fields[AUTHORIZATION_CODE_FIELD] === undefined) {
      throw new LoginError(username, 'submit credentials',
        `${describe('POST', loginForm.url, response)} did not return the sign-in form; ` +
        'the username or password is likely wrong');
    }
    return { action, fields };
  }

  /** Posts Identity's sign-in form to the web app, which sets its login cookie and redirects. */
  private async completeSignIn(context: APIRequestContext, signInForm: SignInForm, username: string): Promise<void> {
    const response = await context.post(signInForm.action, { form: signInForm.fields, maxRedirects: 0 });
    if (response.status() !== 302) {
      throw new LoginError(username, 'complete sign-in',
        `${describe('POST', signInForm.action, response)}, expected 302`);
    }
  }
}

function describe(method: string, url: string, response: APIResponse): string {
  return `${method} ${withoutQuery(url)} -> ${response.status()}`;
}

function withoutQuery(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

/** Name and value of every `<input>` in the page. Identity quotes attributes with " or '. */
function readInputs(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [, attributes = ''] of html.matchAll(/<input\b([^>]*)>/gi)) {
    const name = readAttribute(attributes, 'name');
    const value = readAttribute(attributes, 'value');
    if (name !== undefined) {
      fields[name] = value ?? '';
    }
  }
  return fields;
}

function readFormAction(html: string): string | undefined {
  for (const [, attributes = ''] of html.matchAll(/<form\b([^>]*)>/gi)) {
    const action = readAttribute(attributes, 'action');
    if (action !== undefined && /^https?:\/\//i.test(action)) {
      return action;
    }
  }
  return undefined;
}

function readAttribute(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attributes);
  const raw = match?.[1] ?? match?.[2];
  return raw === undefined ? undefined : decodeEntities(raw);
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}
