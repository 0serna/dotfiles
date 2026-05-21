// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

/** Strip single-quoted and double-quoted strings to prevent false positives. */
function preprocess(command: string): string {
  return command.replace(/'[^']*'/g, "").replace(/"[^"]*"/g, "");
}

// ---------------------------------------------------------------------------
// Sensitive patterns
// ---------------------------------------------------------------------------

/**
 * Flat array of sensitive command patterns, ordered most-specific-first.
 * Each pattern is tested against the preprocessed command string.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  // git push with --delete flag
  /\bgit\s+push\b.*--delete\b/i,
  // git push with --force or -f
  /\bgit\s+push\b.*(?:--force(?:-with-lease)?|\b-f\b)/i,
  // any git push
  /\bgit\s+push\b/i,
  // git reset with --hard
  /\bgit\s+reset\b.*--hard\b/i,
  // git clean with -f or --force
  /\bgit\s+clean\b.*(?:(?:^|\s)-[^\s]*f\b|--force\b)/i,
  // any git rebase
  /\bgit\s+rebase\b/i,
  // git commit with --amend
  /\bgit\s+commit\b.*--amend\b/i,
  // git checkout with -f
  /\bgit\s+checkout\b.*(?:(?:^|\s)-[^\s]*f\b)/i,
  // git switch with --discard-changes
  /\bgit\s+switch\b.*--discard-changes\b/i,
  // git branch with -D or --delete
  /\bgit\s+branch\b.*(?:(?:^|\s)-D\b|--delete\b)/i,
  // git tag with -d or --delete
  /\bgit\s+tag\b.*(?:(?:^|\s)-d\b|--delete\b)/i,
  // gh subcommands
  /\bgh\s+pr\s+(?:create|merge|close|reopen|edit|ready)\b/i,
  /\bgh\s+issue\s+(?:create|edit|close|reopen|delete|transfer|pin|unpin|lock|unlock)\b/i,
  /\bgh\s+repo\s+(?:create|delete|archive|unarchive|edit|rename|fork)\b/i,
  /\bgh\s+release\s+(?:create|edit|delete|upload)\b/i,
  /\bgh\s+workflow\s+(?:run|enable|disable)\b/i,
  /\bgh\s+run\s+(?:cancel|delete|rerun)\b/i,
  // gh api mutations (non-GET method or field/input flags)
  /\bgh\s+api\b[\s\S]*?(?:\s(?:-f|-F|--field|--raw-field|--input)\b|(?:\s|^)(?:-X|--method)(?:\s+|=)(?!GET)[A-Za-z]+)/i,
  // sudo
  /\bsudo\b/i,
  // rm -rf targeting /
  /\brm\s+(?=[^;|&]*(?:-[a-z]*r[a-z]*|--recursive))(?=[^;|&]*(?:-[a-z]*f[a-z]*|--force))(?:--?[a-zA-Z]+\s+)*(?:--\s+)?\/(?:\s|$|[;&|`])/i,
  // dd
  /\bdd\b/i,
  // mkfs, fdisk, parted
  /\b(?:mkfs\.\w+|fdisk|parted)\b/i,
  // shutdown, reboot, poweroff, halt
  /\b(?:shutdown|reboot|poweroff|halt)\b/i,
  // chmod/chown 777
  /\b(?:chmod|chown)\s+(?:-[^\s]+\s+)?777\b/i,
  // curl|wget piped to shell
  /\b(?:curl|wget)\b.*\|\s*(?:bash|sh|zsh|fish)\b/i,
  // shell -c invocation
  /\b(?:bash|sh|zsh|fish)\s+-c\s+/i,
];

// ---------------------------------------------------------------------------
// Sensitivity detection
// ---------------------------------------------------------------------------

/**
 * Preprocess the command then check against all sensitive patterns.
 * Returns the first matching pattern, or null if none match.
 */
export function findSensitiveMatch(command: string): RegExp | null {
  const cleaned = preprocess(command);
  return SENSITIVE_PATTERNS.find((pattern) => pattern.test(cleaned)) ?? null;
}
