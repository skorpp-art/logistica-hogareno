import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

export default function StatsCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">
          {label}
        </p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  );
}
