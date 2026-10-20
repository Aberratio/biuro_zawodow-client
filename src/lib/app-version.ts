export interface AppVersion {
  label: string;
  title: string;
}

const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/i;

/**
 * Version shown in the app chrome. The deploy workflow sets
 * `VITE_APP_VERSION` only when it builds from a release tag (see
 * RELEASING.md) and `VITE_APP_RELEASE` to the commit SHA on every deploy, so
 * staging shows the commit and local builds show nothing.
 */
export function resolveAppVersion(
  version: string | undefined = import.meta.env.VITE_APP_VERSION,
  release: string | undefined = import.meta.env.VITE_APP_RELEASE
): AppVersion | null {
  const tag = version?.trim().replace(/^v/, "") ?? "";
  const sha = release?.trim() ?? "";
  const commit = COMMIT_PATTERN.test(sha) ? sha.slice(0, 7) : "";

  if (tag !== "") {
    return {
      label: `v${tag}`,
      title:
        commit !== "" ? `Wersja ${tag} (commit ${commit})` : `Wersja ${tag}`,
    };
  }

  if (commit !== "") {
    return { label: commit, title: `Wersja niewydana (commit ${commit})` };
  }

  return null;
}
