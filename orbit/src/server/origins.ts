type Environment = Record<string, string | undefined>;

export function production(env: Environment = process.env) {
  return (
    (env.VERCEL === "1" && env.VERCEL_ENV !== "development") ||
    env.APP_ENV === "production" ||
    (env.NODE_ENV === "production" && env.APP_ENV !== "development")
  );
}

function parseOrigin(value: string, httpsOnly: boolean): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (httpsOnly && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.hostname.includes("*") ||
    (httpsOnly && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  ) {
    throw Error("Configure exact HTTPS origins without paths or wildcards");
  }
  return url.origin;
}

export function allowedOrigins(env: Environment = process.env): string[] {
  const secure = production(env);
  const explicit = [env.APP_URL, ...(env.ALLOWED_ORIGINS || "").split(",")]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const allowed = explicit.map((value) => parseOrigin(value, secure));
  // Trust deployment metadata only, never Host / X-Forwarded-Host from requests.
  if (env.VERCEL === "1" && env.VERCEL_ENV !== "development") {
    const names = ["VERCEL_URL", "VERCEL_BRANCH_URL"];
    if (env.VERCEL_ENV === "production")
      names.push("VERCEL_PROJECT_PRODUCTION_URL");
    for (const name of names) {
      const host = env[name]?.trim();
      if (host) {
        if (!/^[a-z0-9.-]+$/i.test(host))
          throw Error("Invalid Vercel deployment hostname");
        allowed.push(parseOrigin("https://" + host, true));
      }
    }
  }
  if (!allowed.length && !secure)
    return ["http://localhost:3000", "http://127.0.0.1:3000"];
  if (!allowed.length)
    throw Error(
      "Configure APP_URL or ALLOWED_ORIGINS, or enable Vercel system environment variables",
    );
  return [...new Set(allowed)];
}
