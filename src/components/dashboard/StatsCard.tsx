import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  gradient?: string;
}

export default function StatsCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  gradient,
}: StatsCardProps) {
  return (
    <div className={`card-base p-6 flex items-center justify-between group animate-fade-in relative overflow-hidden ${gradient || ''}`}>
      <div className="relative z-10">
        <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
          {label}
        </p>
        <p className="text-4xl font-extrabold text-foreground mt-2 animate-count tracking-tight">{value}</p>
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconBg} transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg relative z-10`}>
        <Icon className={`w-7 h-7 ${iconColor}`} />
      </div>
    </div>
  );
}
