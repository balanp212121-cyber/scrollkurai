import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DuoPartnerSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    challengeTitle: string;
    onPartnerSelected: (partnerId: string) => void;
}

export function DuoPartnerSelectionDialog({
    open,
    onOpenChange,
    challengeTitle,
    onPartnerSelected
}: DuoPartnerSelectionDialogProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedPartner, setSelectedPartner] = useState<any | null>(null);

    const searchUsers = async (term: string) => {
        setSearchTerm(term);
        if (!term.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const { data } = await supabase.rpc('search_users_by_username', {
                search_term: term
            });
            // Filter out self logic should ideally be here if search RPC doesn't do it, 
            // but the edge function also checks it.
            setSearchResults(data || []);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleSelect = (user: any) => {
        setSelectedPartner(user);
        setSearchTerm("");
        setSearchResults([]);
    };

    const handleConfirm = () => {
        if (selectedPartner) {
            onPartnerSelected(selectedPartner.id);
            handleClose();
        }
    };

    const handleClose = () => {
        setSearchTerm("");
        setSearchResults([]);
        setSelectedPartner(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Select Duo Partner</DialogTitle>
                    <DialogDescription>
                        Who do you want to tackle "{challengeTitle || 'this challenge'}" with?
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!selectedPartner ? (
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search user by username..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => searchUsers(e.target.value)}
                                />
                            </div>

                            {searching && (
                                <div className="text-sm text-center text-muted-foreground py-2">
                                    Searching...
                                </div>
                            )}

                            {searchResults.length > 0 && (
                                <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                                    {searchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors"
                                            onClick={() => handleSelect(user)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-full">
                                                    <UserPlus className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{user.username}</p>
                                                    <p className="text-xs text-muted-foreground">Level {user.level || 1}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {searchTerm && !searching && searchResults.length === 0 && (
                                <div className="text-sm text-center text-muted-foreground py-4">
                                    No users found matching "{searchTerm}"
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="relative">
                                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-2xl">
                                    {selectedPartner.username.charAt(0).toUpperCase()}
                                </div>
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
                                    onClick={() => setSelectedPartner(null)}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-lg">{selectedPartner.username}</h3>
                                <Badge variant="outline">Level {selectedPartner.level || 1}</Badge>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedPartner}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            Start Duo Challenge
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
