/**
 * Generic email providers that require explicit email approval
 * even if their domain is in the approved_domains collection.
 * 
 * For these providers, only emails explicitly listed in the domain's
 * emails array are approved.
 * 
 * For other domains, if the domain exists in approved_domains,
 * any email from that domain is automatically approved.
 */
export const GENERIC_EMAIL_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "gmx.com",
  "live.com",
  "msn.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
];

/**
 * Check if a domain is a generic email provider
 */
export const isGenericEmailProvider = (domain: string): boolean => {
  return GENERIC_EMAIL_PROVIDERS.includes(domain.toLowerCase());
};
