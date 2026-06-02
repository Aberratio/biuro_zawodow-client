type EnvLike = {
  VITE_APP_ENV?: string;
};

export function isStagingGateEnabled(env: EnvLike): boolean {
  return String(env.VITE_APP_ENV ?? "").trim().toLowerCase() === "staging";
}
