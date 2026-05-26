interface RoomDashboardProps {
  breaksSlot: React.ReactNode;
  presenceSlot: React.ReactNode;
}

export function RoomDashboard({
  breaksSlot,
  presenceSlot,
}: RoomDashboardProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">{breaksSlot}</section>
      <aside className="space-y-4">{presenceSlot}</aside>
    </div>
  );
}
