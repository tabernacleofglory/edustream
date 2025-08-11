
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, getCountFromServer, collectionGroup, query, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Users, MessageSquare, Heart, Repeat2, Share2 } from 'lucide-react';

interface CommunityStats {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  totalReposts: number;
  totalShares: number;
}

const StatCard = ({ icon: Icon, label, value, isLoading }: { icon: React.ElementType, label: string, value: number, isLoading: boolean }) => (
    <div className="flex items-center gap-4">
        <div className="p-2 bg-muted rounded-lg">
            <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
            {isLoading ? (
                <Skeleton className="h-5 w-12" />
            ) : (
                <p className="font-bold text-lg">{value.toLocaleString()}</p>
            )}
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    </div>
);


export default function CommunityStatsSidebar() {
    const [stats, setStats] = useState<Partial<CommunityStats>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);

            const postsQuery = query(collection(db, 'communityPosts'));
            const repliesQuery = query(collectionGroup(db, 'replies'));
            
            const [postsSnapshot, repliesSnapshot] = await Promise.all([
                getDocs(postsQuery),
                getDocs(repliesQuery)
            ]);

            const totalPosts = postsSnapshot.size;
            const totalReplies = repliesSnapshot.size;

            let totalLikes = 0;
            let totalReposts = 0;
            let totalShares = 0;

            postsSnapshot.forEach(doc => {
                totalLikes += doc.data().likeCount || 0;
                totalReposts += doc.data().repostCount || 0;
                totalShares += doc.data().shareCount || 0;
            });
            
            setStats({
                totalPosts: totalPosts,
                totalComments: totalReplies,
                totalLikes: totalLikes,
                totalReposts: totalReposts,
                totalShares: totalShares,
            });

            setLoading(false);
        };

        fetchStats();

        // Set up listeners for real-time updates (optional, can be heavy)
        const unsubscribePosts = onSnapshot(collection(db, 'communityPosts'), () => fetchStats());
        
        return () => {
            unsubscribePosts();
        };
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Community Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <StatCard icon={MessageSquare} label="Total Posts" value={stats.totalPosts || 0} isLoading={loading} />
                <StatCard icon={Heart} label="Total Likes" value={stats.totalLikes || 0} isLoading={loading} />
                <StatCard icon={Repeat2} label="Total Reposts" value={stats.totalReposts || 0} isLoading={loading} />
                <StatCard icon={Share2} label="Total Shares" value={stats.totalShares || 0} isLoading={loading} />
            </CardContent>
        </Card>
    );
}
