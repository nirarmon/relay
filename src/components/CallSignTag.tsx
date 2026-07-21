export type CallSignCategory = "MEDEVAC" | "COMPASSION" | "NONE";

const CONFIG: Record<CallSignCategory, string> = {
  MEDEVAC: "bg-status-breached/10 text-status-breached border-status-breached/40",
  COMPASSION: "bg-status-info/10 text-status-info border-status-info/40",
  NONE: "bg-status-idle/10 text-status-idle border-status-idle/40",
};

export function CallSignTag({ category }: { category: CallSignCategory }) {
  if (category === "NONE") return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide ${CONFIG[category]}`}>
      {category}
    </span>
  );
}
