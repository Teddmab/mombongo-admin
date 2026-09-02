const PALETTE = [
  ["var(--green-700, #1a7a4c)", "var(--green-100, #d7f0e2)"],
  ["#b45309", "#fef3c7"],
  ["#1d4ed8", "#dbeafe"],
  ["#a21caf", "#fae8ff"],
  ["#0f766e", "#ccfbf1"],
  ["#b91c1c", "#fee2e2"],
] as const;

function colorsFor(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Photo avatar when available (avatarUrl), otherwise a deterministic initials circle — most farmers/merchants never upload a photo. */
export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  const [fg, bg] = colorsFor(name || "?");
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, fontWeight: 700,
      }}
    >
      {initialsFor(name)}
    </div>
  );
}
