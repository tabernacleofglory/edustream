
"use client";

<<<<<<< HEAD
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, getCountFromServer, collectionGroup, query, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Users, MessageSquare, Heart, Repeat2, Share2 } from 'lucide-react';

interface CommunityStats {
  totalPosts: number;
  totalComments: number;
=======
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  getDocs
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Heart, Repeat2, Share2 } from "lucide-react";
import type { Post } from "@/lib/types";


interface CommunityStats {
  totalPosts: number;
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
  totalLikes: number;
  totalReposts: number;
  totalShares: number;
}

<<<<<<< HEAD
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
=======
const StatCard = ({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  isLoading: boolean;
}) => (
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
  const [stats, setStats] = useState<CommunityStats>({
    totalPosts: 0,
    totalLikes: 0,
    totalReposts: 0,
    totalShares: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "communityPosts"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalPosts = 0;
      let totalLikes = 0;
      let totalReposts = 0;
      let totalShares = 0;

      snapshot.forEach(doc => {
        const post = doc.data() as Post;
        totalPosts++;
        totalLikes += post.likeCount || 0;
        totalReposts += post.repostCount || 0;
        totalShares += post.shareCount || 0;
      });

      setStats({
        totalPosts,
        totalLikes,
        totalReposts,
        totalShares
      });
      setLoading(false);
    }, (error) => {
      console.error("Error fetching community stats:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatCard
          icon={MessageSquare}
          label="Total Posts"
          value={stats.totalPosts}
          isLoading={loading}
        />
        <StatCard
          icon={Heart}
          label="Total Likes"
          value={stats.totalLikes}
          isLoading={loading}
        />
        <StatCard
          icon={Repeat2}
          label="Total Reposts"
          value={stats.totalReposts}
          isLoading={loading}
        />
        <StatCard
          icon={Share2}
          label="Total Shares"
          value={stats.totalShares}
          isLoading={loading}
        />
      </CardContent>
    </Card>
  );
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
}
