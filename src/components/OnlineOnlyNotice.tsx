interface OnlineOnlyNoticeProps {
  title?: string;
  description: string;
  className?: string;
}

export function OnlineOnlyNotice({
  title = 'Operacje administracyjne sa tymczasowo niedostepne',
  description,
  className = '',
}: OnlineOnlyNoticeProps) {
  return (
    <div className={`rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 ${className}`.trim()}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-current/80">{description}</p>
    </div>
  );
}
