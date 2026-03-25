/**
 * Environment variable validation for production deployment.
 * Call validateEnv() at startup to fail fast if required vars are missing.
 */

const REQUIRED_VARS = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "ADMIN_API_KEY",
] as const

/**
 * Validates that all required environment variables are set and non-empty.
 * Throws an error listing every missing variable if any are absent.
 */
export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === "",
  )

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    )
  }
}
