type StatusPillProps = {
  label: string;
  tone?: "active" | "muted" | "warning";
};

export function StatusPill({ label, tone = "muted" }: StatusPillProps) {
  return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
}
