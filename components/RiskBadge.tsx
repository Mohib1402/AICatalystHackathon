'use client';

interface RiskBadgeProps {
  riskScore: number;
  riskLevel: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function RiskBadge({ 
  riskScore, 
  riskLevel, 
  size = 'md',
  showLabel = true 
}: RiskBadgeProps) {
  const getColorClasses = () => {
    if (riskScore >= 76) {
      return {
        bg: 'bg-red-500',
        border: 'border-red-600',
        text: 'text-red-50',
        glow: 'shadow-red-500/50',
        icon: '🚨'
      };
    } else if (riskScore >= 51) {
      return {
        bg: 'bg-orange-500',
        border: 'border-orange-600',
        text: 'text-orange-50',
        glow: 'shadow-orange-500/50',
        icon: '⚠️'
      };
    } else if (riskScore >= 26) {
      return {
        bg: 'bg-yellow-500',
        border: 'border-yellow-600',
        text: 'text-yellow-50',
        glow: 'shadow-yellow-500/50',
        icon: '⚡'
      };
    } else {
      return {
        bg: 'bg-green-500',
        border: 'border-green-600',
        text: 'text-green-50',
        glow: 'shadow-green-500/50',
        icon: '✅'
      };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'lg':
        return 'px-4 py-2 text-base';
      default:
        return 'px-3 py-1 text-sm';
    }
  };

  const colors = getColorClasses();
  const sizeClasses = getSizeClasses();

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border-2 font-semibold ${colors.bg} ${colors.border} ${colors.text} ${sizeClasses} shadow-lg ${colors.glow}`}>
      <span className="text-base leading-none">{colors.icon}</span>
      <span className="font-mono font-bold">{riskScore}</span>
      {showLabel && (
        <span className="uppercase tracking-wide opacity-90">
          {riskLevel}
        </span>
      )}
    </div>
  );
}
