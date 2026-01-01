import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Users, Trophy, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface Challenge {
  id: string;
  title: string;
  target_value: number;
  target_type: string;
  ends_at: string;
}

interface Participant {
  id: string;
  user_id: string;
  challenge_id: string;
  current_progress: number;
  completed: boolean;
  joined_at: string;
  challenges: Challenge;
  username?: string;
}

export function ChallengeParticipantsManager() {
  const [selectedChallenge, setSelectedChallenge] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch all challenges for the dropdown
  const { data: challenges } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("id, title, target_value, target_type, ends_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Challenge[];
    },
  });

  // Fetch all participants with challenge details
  const { data: participants, isLoading } = useQuery({
    queryKey: ["admin-challenge-participants", selectedChallenge, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("challenge_participants")
        .select(`
          id,
          user_id,
          challenge_id,
          current_progress,
          completed,
          joined_at,
          challenges(id, title, target_value, target_type, ends_at)
        `)
        .order("joined_at", { ascending: false });

      if (selectedChallenge !== "all") {
        query = query.eq("challenge_id", selectedChallenge);
      }

      if (filterStatus === "completed") {
        query = query.eq("completed", true);
      } else if (filterStatus === "in_progress") {
        query = query.eq("completed", false);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch usernames for all participants
      const userIds = [...new Set((data || []).map((p: any) => p.user_id))];
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .rpc("get_profiles_by_ids", { user_ids: userIds });

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.username]));

        return (data || []).map((p: any) => ({
          ...p,
          username: profileMap.get(p.user_id) || "Unknown User",
        })) as Participant[];
      }

      return (data || []).map((p: any) => ({
        ...p,
        username: "Unknown User",
      })) as Participant[];
    },
  });

  // Filter by search term
  const filteredParticipants = participants?.filter((p) => {
    if (!searchTerm) return true;
    return (
      p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.challenges?.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Stats
  const stats = {
    total: participants?.length || 0,
    completed: participants?.filter((p) => p.completed).length || 0,
    inProgress: participants?.filter((p) => !p.completed).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Across all challenges</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Still working</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter participants by challenge, status, or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username, user ID, or challenge..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedChallenge} onValueChange={setSelectedChallenge}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select Challenge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Challenges</SelectItem>
                {challenges?.map((challenge) => (
                  <SelectItem key={challenge.id} value={challenge.id}>
                    {challenge.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Participants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Challenge Participants</CardTitle>
          <CardDescription>
            {filteredParticipants?.length || 0} participant(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading participants...
            </div>
          ) : filteredParticipants && filteredParticipants.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Challenge</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((participant) => {
                    const progressPercent = participant.challenges?.target_value
                      ? Math.min(100, (participant.current_progress / participant.challenges.target_value) * 100)
                      : 0;

                    return (
                      <TableRow key={participant.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{participant.username}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {participant.user_id.slice(0, 8)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{participant.challenges?.title || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">
                              Target: {participant.challenges?.target_value} {participant.challenges?.target_type}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-32">
                            <div className="flex justify-between text-xs">
                              <span>{participant.current_progress}</span>
                              <span className="text-muted-foreground">
                                / {participant.challenges?.target_value}
                              </span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                            <p className="text-xs text-muted-foreground text-right">
                              {Math.round(progressPercent)}%
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {participant.completed ? (
                            <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/30 text-amber-500">
                              <Clock className="w-3 h-3 mr-1" />
                              In Progress
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(participant.joined_at), "MMM dd, yyyy")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No participants found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
