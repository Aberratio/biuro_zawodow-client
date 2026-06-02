type EnvLike = {
  VITE_APP_ENV?: string;
  VITE_STAGING_GATE_PASSWORD?: string;
};

export function isStagingGateEnabled(env: EnvLike): boolean {
  return (
    String(env.VITE_APP_ENV ?? "").trim().toLowerCase() === "staging" &&
    String(env.VITE_STAGING_GATE_PASSWORD ?? "").length > 0
  );
}

export function getStagingGatePassword(env: EnvLike): string {
  return String(env.VITE_STAGING_GATE_PASSWORD ?? "");
}
