import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Check, Sparkles } from "lucide-react";

interface IdentityClass {
    id: string;
    name: string;
    icon: string;
    description: string;
    philosophy: string;
    color: string;
    quest_themes: string[];
}

interface IdentityClassSelectorProps {
    currentClass?: string | null;
    userLevel: number;
    lockedUntil?: string | null;
    onClassChange?: () => void;
}

export function IdentityClassSelector({
    currentClass,
    userLevel,
    lockedUntil,
    onClassChange
}: IdentityClassSelectorProps) {
    const [classes, setClasses] = useState<IdentityClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [selectedClass, setSelectedClass] = useState<IdentityClass | null>(null);

    const isLocked = userLevel < 5;
    const isOnCooldown = lockedUntil && new Date(lockedUntil) > new Date();

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const { data, error } = await supabase
                .from("identity_classes")
                .select("*");

            if (error) throw error;
            setClasses(data || []);
        } catch (error) {
            console.error("Error fetching identity classes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (cls: IdentityClass) => {
        if (isLocked || isOnCooldown) return;
        setSelectedClass(cls);
        setShowConfirm(true);
    };

    const confirmSelection = async () => {
        if (!selectedClass) return;

        setSelecting(selectedClass.id);
        try {
            const { data, error } = await (supabase.rpc as any)("choose_identity_class", {
                p_class_id: selectedClass.id,
            });

            if (error) throw error;

            if (data?.success) {
                toast.success("Identity Awakened", {
                    description: `You are now a ${selectedClass.name}`,
                });
                onClassChange?.();
            } else {
                toast.error(data?.reason || "Failed to choose class");
            }
        } catch (error) {
            console.error("Error choosing class:", error);
            toast.error("Failed to choose identity class");
        } finally {
            setSelecting(null);
            setShowConfirm(false);
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-muted rounded w-1/3" />
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-32 bg-muted rounded" />
                        ))}
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Identity Class
                        {isLocked && (
                            <Badge variant="secondary" className="ml-auto">
                                <Lock className="w-3 h-3 mr-1" /> Level 5
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLocked && (
                        <div className="mb-4 p-3 rounded-lg bg-muted/50 text-center">
                            <p className="text-sm text-muted-foreground">
                                Reach <span className="font-bold text-primary">Level 5</span> to unlock your identity
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Your identity shapes your quests, badges, and growth path.
                            </p>
                        </div>
                    )}

                    {isOnCooldown && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 text-center">
                            <p className="text-sm text-amber-500">
                                Identity locked until {new Date(lockedUntil!).toLocaleDateString()}
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        {classes.map((cls) => {
                            const isSelected = currentClass === cls.id;
                            const canSelect = !isLocked && !isOnCooldown && !isSelected;

                            return (
                                <Card
                                    key={cls.id}
                                    className={`p-4 cursor-pointer transition-all ${isSelected
                                            ? "ring-2 ring-primary bg-primary/10"
                                            : canSelect
                                                ? "hover:border-primary/50 hover:bg-muted/50"
                                                : "opacity-60"
                                        }`}
                                    style={{ borderColor: isSelected ? cls.color : undefined }}
                                    onClick={() => canSelect && handleSelect(cls)}
                                >
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">{cls.icon}</div>
                                        <h3 className="font-bold text-sm">{cls.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {cls.description}
                                        </p>
                                        {isSelected && (
                                            <Badge className="mt-2 bg-primary/20" style={{ color: cls.color }}>
                                                <Check className="w-3 h-3 mr-1" /> Active
                                            </Badge>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="text-3xl">{selectedClass?.icon}</span>
                            Become a {selectedClass?.name}?
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            <p className="italic mb-3">"{selectedClass?.philosophy}"</p>
                            <p className="text-sm">
                                Your identity will shape your quests, badges, and growth path.
                                You can change this once every 30 days.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 mt-4">
                        <Button variant="outline" onClick={() => setShowConfirm(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmSelection}
                            disabled={!!selecting}
                            className="flex-1"
                            style={{ backgroundColor: selectedClass?.color }}
                        >
                            {selecting ? "Awakening..." : "Confirm"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
