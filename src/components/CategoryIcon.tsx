import {
  Home,
  Zap,
  Shield,
  Tv,
  ShoppingCart,
  Wifi,
  Car,
  HeartPulse,
  FileText,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  home: Home,
  zap: Zap,
  shield: Shield,
  tv: Tv,
  'shopping-cart': ShoppingCart,
  wifi: Wifi,
  car: Car,
  'heart-pulse': HeartPulse,
  'file-text': FileText,
};

interface CategoryIconProps {
  icon: string;
  className?: string;
}

export function CategoryIcon({ icon, className = 'w-6 h-6' }: CategoryIconProps) {
  const IconComponent = iconMap[icon] || FileText;
  return <IconComponent className={className} style={{ color: '#64748b' }} />;
}

export function getCategoryIconComponent(category: string): LucideIcon {
  const iconName = category === 'mortgage' ? 'home' :
    category === 'utility' ? 'zap' :
    category === 'insurance' ? 'shield' :
    category === 'subscription' ? 'tv' :
    category === 'groceries' ? 'shopping-cart' :
    category === 'internet' ? 'wifi' :
    category === 'transportation' ? 'car' :
    category === 'medical' ? 'heart-pulse' : 'file-text';

  return iconMap[iconName] || FileText;
}
