import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, UserMinus, Check, X, Trophy, Zap, Search } from "lucide-react";
import { toast } from "sonner";
import { TeamInvitesList } from "@/components/Teams/TeamInvitesList";
import { ReferralDashboard } from "@/components/Referrals/ReferralDashboard";

interface Friend {
  id: string;
  status: string;
  created_at: string;
  friend_id?: string;
  user_id?: string;
  friend_profile?: {
    id: string;
    username: string;
    level: number;
    xp: number;
    streak: number;
  };
}

interface UserSuggestion {
  id: string;
  username: string;
  level: number;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<Friend[]>([]);
  const [searchUsername, setSearchUsername] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchFriends();

    // Close suggestions when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Cleanup debounce timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Accepted friends
      const { data: acceptedFriends } = await supabase
        .from('friends')
        .select('id, status, created_at, friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      // Pending requests received
      const { data: pending } = await supabase
        .from('friends')
        .select('id, status, created_at, user_id')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      // Sent requests
      const { data: sent } = await supabase
        .from('friends')
        .select('id, status, created_at, friend_id')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      // Fetch profiles using RPC function
      if (acceptedFriends && acceptedFriends.length > 0) {
        const friendIds = acceptedFriends.map(f => f.friend_id);
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', {
          user_ids: friendIds
        });

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        setFriends(acceptedFriends.map(f => ({
          ...f,
          friend_profile: profileMap.get(f.friend_id)
        })) || []);
      } else {
        setFriends([]);
      }

      // Fetch profiles for pending requests
      if (pending && pending.length > 0) {
        const userIds = pending.map(p => p.user_id);
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', {
          user_ids: userIds
        });

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        setPendingRequests(pending.map(p => ({
          ...p,
          friend_profile: profileMap.get(p.user_id)
        })) || []);
      } else {
        setPendingRequests([]);
      }

      // Fetch profiles for sent requests
      if (sent && sent.length > 0) {
        const friendIds = sent.map(s => s.friend_id);
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', {
          user_ids: friendIds
        });

        const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
        setSentRequests(sent.map(s => ({
          ...s,
          friend_profile: profileMap.get(s.friend_id)
        })) || []);
      } else {
        setSentRequests([]);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchUsername(value);

    // Clear existing debounce timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 1) {
      setSearchLoading(true);
      setShowSuggestions(true); // Show dropdown immediately for loading state

      // Debounce API call by 300ms
      debounceRef.current = setTimeout(async () => {
        try {
          console.log('Searching for:', value.trim());
          const { data: users, error } = await supabase.rpc('search_users_by_username', {
            search_term: value.trim()
          });

          console.log('Search results:', users, 'Error:', error);

          if (!error && users) {
            const { data: { user } } = await supabase.auth.getUser();
            // Filter out current user from suggestions
            const filtered = users.filter((u: UserSuggestion) => u.id !== user?.id);
            console.log('Filtered results:', filtered);
            setSuggestions(filtered);
            setShowSuggestions(true); // Keep dropdown open to show results or "No users found"
          } else {
            setSuggestions([]);
            setShowSuggestions(true); // Show "No users found"
          }
        } catch (error) {
          console.error('Error searching users:', error);
          setSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchLoading(false);
    }
  };

  const handleSelectSuggestion = (user: UserSuggestion) => {
    setSearchUsername(user.username);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSendRequest = async (targetUsername?: string) => {
    const username = targetUsername || searchUsername;
    if (!username.trim()) {
      toast.error('Enter a username');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find user by username using RPC function
      const { data: users, error: searchError } = await supabase.rpc('search_users_by_username', {
        search_term: username.trim()
      });

      if (searchError) throw searchError;

      if (!users || users.length === 0) {
        toast.error('User not found');
        return;
      }

      // Find exact match
      const targetUser = users.find((u: UserSuggestion) =>
        u.username.toLowerCase() === username.trim().toLowerCase()
      ) || users[0];

      if (targetUser.id === user.id) {
        toast.error("You can't add yourself");
        return;
      }

      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: targetUser.id,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      setSearchUsername('');
      setSuggestions([]);
      setShowSuggestions(false);
      fetchFriends();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Request already sent');
      } else {
        console.error('Error sending friend request:', error);
        toast.error('Failed to send request');
      }
    }
  };

  const handleAcceptRequest = async (requestId: string, senderId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to accept friend requests');
        return;
      }

      // Get the request to find the sender
      const { data: requestData } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .eq('id', requestId)
        .single();

      if (!requestData) {
        toast.error('Friend request not found');
        return;
      }

      const friendUserId = requestData.user_id; // The person who sent the request

      // 1. Update original request to accepted
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 2. Create reciprocal friendship row (current user → sender)
      // This makes the friendship bidirectional
      const { error: insertError } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: friendUserId,
          status: 'accepted'
        });

      // Ignore duplicate key error (friendship might already exist from previous accept)
      if (insertError && insertError.code !== '23505') {
        console.error('Error creating reciprocal friendship:', insertError);
      }

      // 3. Instant UI update - move from pending to friends
      const acceptedRequest = pendingRequests.find(r => r.id === requestId);
      if (acceptedRequest) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        setFriends(prev => [...prev, {
          ...acceptedRequest,
          status: 'accepted',
          friend_id: friendUserId,
          friend_profile: acceptedRequest.friend_profile
        }]);
      }

      toast.success('Friend request accepted! 🎉', {
        description: 'You can now add them to teams and duos'
      });

      // Background refresh to sync with DB
      fetchFriends();
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request rejected');
      fetchFriends();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const handleUnfriend = async (friendId: string, friendUsername: string) => {
    if (!friendId) {
      toast.error('Unable to unfriend: Invalid friend ID');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to unfriend');
        return;
      }

      console.log('Unfriending:', { friendId, friendUsername, userId: user.id });

      // Delete friendship record where current user is user_id
      const { error: error1, count: count1 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user.id)
        .eq('friend_id', friendId);

      // Delete friendship record where current user is friend_id (reverse direction)
      const { error: error2, count: count2 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', user.id);

      console.log('Delete results:', { error1, error2, count1, count2 });

      if (error1) console.error('Error deleting direction 1:', error1);
      if (error2) console.error('Error deleting direction 2:', error2);

      // If both failed, show error
      if (error1 && error2) {
        throw new Error('Failed to delete friendship records');
      }

      toast.success(`Unfriended ${friendUsername}`);
      fetchFriends();
    } catch (error) {
      console.error('Error unfriending:', error);
      toast.error('Failed to unfriend');
    }
  };

  return (
    <div className="pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Friends
          </h1>
          <p className="text-sm text-muted-foreground">Connect and compete</p>
        </div>
      </div>

      {/* Add Friend */}
      <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-primary/20">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Add Friend</h2>
          </div>
          <div className="relative" ref={suggestionRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search username..."
                  value={searchUsername}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendRequest()}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => handleSendRequest()} className="bg-primary">
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                {searchLoading ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    Searching...
                  </div>
                ) : suggestions.length > 0 ? (
                  <ul className="max-h-60 overflow-y-auto">
                    {suggestions.map((user) => (
                      <li
                        key={user.id}
                        className="flex items-center justify-between p-3 hover:bg-accent/10 cursor-pointer transition-colors border-b border-border last:border-b-0"
                        onClick={() => handleSelectSuggestion(user)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold text-primary-foreground">
                            {user.username?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{user.username}</p>
                            <p className="text-xs text-muted-foreground">Level {user.level}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendRequest(user.username);
                          }}
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Team Invites */}
      <TeamInvitesList />

      {/* Tabs */}
      <Tabs defaultValue="friends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends">
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Requests ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent ({sentRequests.length})
          </TabsTrigger>
          <TabsTrigger value="referrals">
            Referrals
          </TabsTrigger>
        </TabsList>

        {/* Friends List */}
        <TabsContent value="friends" className="space-y-3">
          {loading ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          ) : friends.length === 0 ? (
            <Card className="p-6 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No friends yet. Add some!</p>
            </Card>
          ) : (
            friends.map((friend) => (
              <Card key={friend.id} className="p-4 bg-card/50 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl font-bold">
                      {friend.friend_profile?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold">{friend.friend_profile?.username}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> Lvl {friend.friend_profile?.level}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" /> {friend.friend_profile?.xp} XP
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary">
                      🔥 {friend.friend_profile?.streak}
                    </Badge>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => handleUnfriend(
                        friend.friend_id || friend.friend_profile?.id || '',
                        friend.friend_profile?.username || 'this user'
                      )}
                    >
                      <UserMinus className="w-4 h-4" />
                      <span className="hidden sm:inline">Unfriend</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Pending Requests */}
        <TabsContent value="pending" className="space-y-3">
          {pendingRequests.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No pending requests</p>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <Card key={request.id} className="p-4 bg-card/50 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold">
                      {request.friend_profile?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium">{request.friend_profile?.username}</h3>
                      <p className="text-xs text-muted-foreground">Lvl {request.friend_profile?.level}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(request.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectRequest(request.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Sent Requests */}
        <TabsContent value="sent" className="space-y-3">
          {sentRequests.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No sent requests</p>
            </Card>
          ) : (
            sentRequests.map((request) => (
              <Card key={request.id} className="p-4 bg-card/50 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold">
                      {request.friend_profile?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium">{request.friend_profile?.username}</h3>
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Referrals */}
        <TabsContent value="referrals" className="space-y-6">
          <ReferralDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}