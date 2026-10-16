export interface EvidenceBugInput {
  category: string;
  title?: string | null;
  description?: string | null;
  actual?: string | null;
  rule?: string | null;
}

const BUTTON_FAILURE = /click-button|button-disabled|button-visibility|button-viewport/;
const WRONG_DATA = /invalid-email|invalid-phone|short-password|boundary-text|dummy-submit|dummy-fill/;
const LOGIN_PROBE = /sign in with google|sign in|log in|login/;

function textOf(input: EvidenceBugInput): string {
  return `${input.rule ?? ""} ${input.title ?? ""} ${input.description ?? ""} ${input.actual ?? ""}`.toLowerCase();
}

export function isDetailedEvidenceBug(input: EvidenceBugInput): boolean {
  const text = textOf(input);

  if (input.category === "BROKEN_LINK" || input.category === "BROKEN_IMAGE") return true;

  if (input.category === "NETWORK") return text.includes("api failed");

  if (input.category === "SEO") {
    return (
      input.rule === "title-missing" ||
      input.rule === "h1-missing" ||
      text.includes("title is missing") ||
      text.includes("page has no h1") ||
      text.includes("keyword")
    );
  }

  if (input.category === "FUNCTIONAL") {
    if (LOGIN_PROBE.test(text)) return false;
    return BUTTON_FAILURE.test(text) || WRONG_DATA.test(text);
  }

  return false;
}
