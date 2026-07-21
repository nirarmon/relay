export interface CustodyTimelineEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  custodianRole: string;
  proofType: string | null;
}

export function CustodyTimeline({ events }: { events: CustodyTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Awaiting cross-clamp — no custody events yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3 border-l border-slate-800 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-status-info" />
          <div className="flex items-center gap-2 font-mono text-sm text-slate-200">
            <span className="font-semibold">{event.eventType}</span>
            <span className="text-slate-500">{event.custodianRole}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
            {event.proofType && <span>· proof: {event.proofType}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
