import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PremiumFeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  link?: string;
  badge?: string;
}

export function PremiumFeatureCard({ icon, title, description, link, badge }: PremiumFeatureCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex gap-4 flex-1">
          <div className="p-3 bg-primary/10 rounded-lg">
            {icon}
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold">{title}</h3>
              {badge && (
                <Badge className="bg-accent/20 text-accent border-accent/30">
                  {badge}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {link && !badge && (
          <Button onClick={() => navigate(link)} variant="ghost" size="sm">
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}