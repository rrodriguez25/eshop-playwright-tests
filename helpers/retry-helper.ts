/**
 * Retrying and polling for actions that can fail for reasons outside the test's control, such as
 * work eShop finishes in the background.
 *
 * Prefer Playwright's own waiting first: web-first assertions, `expect.poll` and
 * `expect(...).toPass()`. Add a function here only for cases those can't express, such as
 * retrying an action (not an assertion) with a growing delay.
 */
export {};
