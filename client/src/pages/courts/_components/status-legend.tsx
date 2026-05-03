export function StatusLegend() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 px-1">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        已確認
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        待確認
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        會員
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded border border-dashed border-gray-300" />
        可預約
      </div>
    </div>
  );
}
