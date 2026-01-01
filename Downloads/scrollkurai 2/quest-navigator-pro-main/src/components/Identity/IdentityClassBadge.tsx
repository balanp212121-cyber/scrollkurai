import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface IdentityClassBadgeProps {
    classId: string | null;
    size?: "sm" | "md" | "lg";
    showName?: boolean;
}

const IDENTITY_CLASSES: Record<string, {
    name: string;
    icon: string;
    color: string;
    bgColor: string;
}> = {
    mind_warrior: {
        name: "Mind Warrior",
        icon: "🧠",
        color: "text-indigo-400",
        bgColor: "bg-indigo-500/20",
    },
    focus_assassin: {
        name: "Focus Assassin",
        icon: "⚡",
        color: "text-amber-400",
        bgColor: "bg-amber-500/20",
    },
    discipline_monk: {
        name: "Discipline Monk",
        icon: "🔥",
        color: "text-red-400",
        bgColor: "bg-red-500/20",
    },
    calm_strategist: {
        name: "Calm Strategist",
        icon: "👑",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/20",
    },
};

export function IdentityClassBadge({ classId, size = "md", showName = false }: IdentityClassBadgeProps) {
    if (!classId) return null;

    const identity = IDENTITY_CLASSES[classId];
    if (!identity) return null;

    const sizeClasses = {
        sm: "text-sm px-1.5 py-0.5",
        md: "text-base px-2 py-1",
        lg: "text-lg px-3 py-1.5",
    };

    const iconSizes = {
        sm: "text-sm",
        md: "text-lg",
        lg: "text-2xl",
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <Badge
                        className={`${identity.bgColor} ${identity.color} ${sizeClasses[size]} font-medium`}
                        variant="outline"
                    >
                        <span className={iconSizes[size]}>{identity.icon}</span>
                        {showName && <span className="ml-1">{identity.name}</span>}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{identity.name}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
