const DEFAULT_FUNCTIONS_BASE_URL = "/.netlify/functions";

export const getFunctionUrl = (name: string) => {
  const base = import.meta.env.VITE_FUNCTIONS_BASE_URL || DEFAULT_FUNCTIONS_BASE_URL;
  return `${base.replace(/\/$/, "")}/${name}`;
};
