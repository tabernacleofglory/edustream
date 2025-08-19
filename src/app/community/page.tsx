
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, increment, arrayUnion, arrayRemove, where, getDocs, getDoc, collectionGroup, getCountFromServer } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Heart, MessageSquare, Trash2, Send, Repeat2, Pin, Share2, Edit, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { User, Post, Ladder } from '@/lib/types';
import CommunityStatsSidebar from '@/components/community-stats-sidebar';
import UserProfileSidebar from '@/components/user-profile-sidebar';
import ReactPlayer from 'react-player';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
<<<<<<< HEAD
=======
import AnnouncementCard from '@/components/announcement-card';
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)


const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map((n) => n[0]).join("").toUpperCase();
};

const EditFormComponent = ({ initialContent, onSave, onCancel, type = 'Post' }: { initialContent: string, onSave: (newContent: string) => Promise<void>, onCancel: () => void, type?: 'Post' | 'Comment' }) => {
    const [content, setContent] = useState(initialContent);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(content);
        setIsSaving(false);
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit {type}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

<<<<<<< HEAD
=======
const CommentComponent = ({ 
    comment, 
    onDelete, 
    onEdit,
    onViewProfile
}: { 
    comment: Post, 
    onDelete: (comment: Post) => void,
    onEdit: (comment: Post, newContent: string) => void,
    onViewProfile: (userId: string) => void,
}) => {
    const { user, hasPermission } = useAuth();
    const [isEditing, setIsEditing] = useState(false);

    const canEdit = user?.uid === comment.authorId;
    const canDelete = hasPermission('manageCommunity') || user?.uid === comment.authorId;

    const handleSaveEdit = async (newContent: string) => {
        await onEdit(comment, newContent);
        setIsEditing(false);
    };

    return (
        <div className="flex items-start gap-3 mt-2 group relative">
            <button onClick={() => onViewProfile(comment.authorId)}>
                <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.authorPhotoURL || undefined} alt={comment.authorName} />
                    <AvatarFallback>{getInitials(comment.authorName)}</AvatarFallback>
                </Avatar>
            </button>
            <div className="flex-1 bg-background p-2 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => onViewProfile(comment.authorId)} className="font-semibold hover:underline">{comment.authorName}</button>
                    <span className="text-muted-foreground">
                        {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}
                    </span>
                </div>
                <p className="text-sm mt-1">{comment.content}</p>
            </div>
            <div className="absolute top-1 right-1 flex opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
                        <Edit className="h-3 w-3" />
                    </Button>
                )}
                {canDelete && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(comment)}>
                        <Trash2 className="h-3 w-3" />
                    </Button>
                )}
            </div>

             <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <EditFormComponent
                    initialContent={comment.content}
                    onSave={handleSaveEdit}
                    onCancel={() => setIsEditing(false)}
                    type="Comment"
                />
            </Dialog>
        </div>
    );
};

>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)

const ReplyFormComponent = ({ parentComment, onReplyPosted, onCancel }: { parentComment: Post, onReplyPosted: () => void, onCancel: () => void }) => {
    const [replyText, setReplyText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !user) return;
        setIsSubmitting(true);

        const replyData = {
            authorId: user.uid,
            authorName: user.displayName,
            authorPhotoURL: user.photoURL,
            content: replyText.trim(),
            createdAt: serverTimestamp(),
            likes: [],
            likeCount: 0,
            parentId: parentComment.id,
            parentAuthorName: parentComment.authorName,
        };

        try {
            await addDoc(collection(db, "communityPosts", parentComment.id, "replies"), replyData);
            setReplyText('');
            onReplyPosted();
        } catch(err) {
            console.error("Error posting reply: ", err);
            toast({ variant: 'destructive', title: 'Failed to post reply.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <form onSubmit={handleReplySubmit} className="flex items-start gap-2 pt-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <Textarea
                    placeholder={`Replying to ${parentComment.authorName}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full text-sm"
                    rows={2}
                    disabled={isSubmitting}
                />
                <div className="flex justify-end items-center mt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={isSubmitting || !replyText.trim()}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reply
                    </Button>
                </div>
            </div>
        </form>
    );
};


const PostCard = ({ post, onRepost, onPin, onViewProfile }: { post: Post, onRepost: (post: Post) => void, onPin: (post: Post) => void, onViewProfile: (userId: string) => void }) => {
    const { user, hasPermission } = useAuth();
    const { toast } = useToast();
    const [replies, setReplies] = useState<Post[]>([]);
    const [isReplying, setIsReplying] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    const canManage = hasPermission('manageCommunity');
    const canEdit = user?.uid === post.authorId;
    const canDelete = canManage || user?.uid === post.authorId;

    useEffect(() => {
        if (!user) return;
        const repliesQuery = query(collection(db, 'communityPosts', post.id, 'replies'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(repliesQuery, snapshot => {
            const fetchedReplies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
            setReplies(fetchedReplies);
        }, (error) => {
            console.error("Error fetching replies: ", error);
        });
        return () => unsubscribe();
    }, [post.id, user]);

    const handleLike = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to like posts.' });
            return;
        }
        const postRef = doc(db, 'communityPosts', post.id);
        const isLiked = post.likes && post.likes.includes(user.uid);
        
        await updateDoc(postRef, {
            likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
            likeCount: increment(isLiked ? -1 : 1),
        });
    };
    
    const handleDelete = async () => {
        if (!canDelete) {
            toast({ variant: 'destructive', title: 'You do not have permission to delete this post.' });
            return;
        }
        if(window.confirm("Are you sure you want to delete this post?")) {
            await deleteDoc(doc(db, 'communityPosts', post.id));
            toast({ title: 'Post deleted.' });
        }
    }

    const handleSaveEdit = async (newContent: string) => {
        if (!canEdit) return;
        const postRef = doc(db, 'communityPosts', post.id);
        await updateDoc(postRef, { content: newContent });
        toast({ title: "Post updated!" });
        setIsEditing(false);
    };
<<<<<<< HEAD
=======
    
     const handleDeleteReply = async (reply: Post) => {
        if (!hasPermission('manageCommunity') && user?.uid !== reply.authorId) {
            toast({ variant: 'destructive', title: 'You do not have permission to delete this reply.' });
            return;
        }
        if (window.confirm("Are you sure you want to delete this reply?")) {
            await deleteDoc(doc(db, 'communityPosts', post.id, 'replies', reply.id));
            toast({ title: 'Reply deleted.' });
        }
    };
    
    const handleEditReply = async (reply: Post, newContent: string) => {
        if (user?.uid !== reply.authorId) return;
        const replyRef = doc(db, 'communityPosts', post.id, 'replies', reply.id);
        await updateDoc(replyRef, { content: newContent });
        toast({ title: 'Reply updated!' });
    };
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)

    const handleShare = async () => {
        const shareData = {
            title: `Post by ${post.authorName}`,
            text: post.content,
            url: window.location.href, // Or a specific post URL if available
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                 navigator.clipboard.writeText(shareData.url);
                 toast({ title: "Link copied to clipboard" });
            }
            // Increment share count in Firestore
            const postRef = doc(db, 'communityPosts', post.id);
            await updateDoc(postRef, { shareCount: increment(1) });

        } catch (err) {
            console.log("Share failed, falling back to clipboard", err);
            navigator.clipboard.writeText(shareData.url);
            toast({ title: "Link copied to clipboard" });
        }
    };

    const userHasLiked = user ? post.likes?.includes(user.uid) : false;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = post.content.split(urlRegex);
    const firstUrl = post.content.match(urlRegex)?.[0];

    return (
        <>
        <Card className={cn("w-full", post.isPinned && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800")}>
             {post.isPinned && (
                <div className="px-4 pt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    <Pin className="h-4 w-4" /> Pinned Post
                </div>
            )}
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4">
                 <button onClick={() => onViewProfile(post.authorId)} className="cursor-pointer">
                    <Avatar>
                        <AvatarImage src={post.authorPhotoURL || undefined} alt={post.authorName} />
                        <AvatarFallback>{getInitials(post.authorName)}</AvatarFallback>
                    </Avatar>
                </button>
                <div className="flex-1">
                     <button onClick={() => onViewProfile(post.authorId)} className="cursor-pointer text-left">
                        <p className="font-semibold hover:underline">{post.authorName}</p>
                    </button>
                    {post.createdAt && (
                        <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true })}
                        </p>
                    )}
                    {post.repostOf && (
                        <p className="text-xs text-muted-foreground">
                            Reposted from <span className="font-semibold">{post.originalAuthorName}</span>
                        </p>
                    )}
                </div>
                {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="text-muted-foreground hover:text-primary h-7 w-7">
                        <Edit className="h-4 w-4" />
                    </Button>
                )}
                 {canDelete && (
                    <Button variant="ghost" size="icon" onClick={handleDelete} className="text-muted-foreground hover:text-destructive h-7 w-7">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                 {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => onPin(post)} className={cn("text-muted-foreground hover:text-amber-500 h-7 w-7", post.isPinned && "text-amber-500")}>
                        <Pin className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-4 pt-0">
                 <div className="whitespace-pre-wrap text-sm">
                    {parts.map((part, index) =>
                        urlRegex.test(part) ? (
                            <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{part}</a>
                        ) : (
                            <React.Fragment key={index}>{part}</React.Fragment>
                        )
                    )}
                </div>
                {firstUrl && ReactPlayer.canPlay(firstUrl) && (
                    <div className="mt-4 aspect-video">
                        <ReactPlayer url={firstUrl} width="100%" height="100%" controls />
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-4 pt-0 border-t mt-2">
                <div className="flex gap-1 justify-around w-full">
                    <Button variant="ghost" size="sm" onClick={handleLike} className="flex-1">
                        <Heart className={cn("mr-2 h-4 w-4", userHasLiked && "fill-red-500 text-red-500")} />
                        {post.likeCount || 0}
                    </Button>
                     <Button variant="ghost" size="sm" onClick={() => setIsReplying(prev => !prev)} className="flex-1">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {replies.length}
                    </Button>
                     <Button variant="ghost" size="sm" onClick={() => onRepost(post)} className="flex-1">
                        <Repeat2 className="mr-2 h-4 w-4" />
                        {post.repostCount || 0}
                    </Button>
                     <Button variant="ghost" size="sm" onClick={handleShare} className="flex-1">
                        <Share2 className="mr-2 h-4 w-4" />
                        {post.shareCount || 0}
                    </Button>
                </div>
            </CardFooter>
            {isReplying && (
                <div className="p-4 border-t">
                    <ReplyFormComponent parentComment={post} onReplyPosted={() => setIsReplying(false)} onCancel={() => setIsReplying(false)} />
                </div>
            )}
            {replies.length > 0 && (
                <div className="p-4 border-t bg-muted/50">
                    {replies.map(reply => (
<<<<<<< HEAD
                        <div key={reply.id} className="flex items-start gap-3 mt-2">
                             <Avatar className="h-8 w-8">
                                <AvatarImage src={reply.authorPhotoURL || undefined} alt={reply.authorName} />
                                <AvatarFallback>{getInitials(reply.authorName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-background p-2 rounded-lg">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold">{reply.authorName}</span>
                                     <span className="text-muted-foreground">
                                        {reply.createdAt ? formatDistanceToNow(new Date(reply.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}
                                    </span>
                                </div>
                                <p className="text-sm mt-1">{reply.content}</p>
                            </div>
                        </div>
=======
                        <CommentComponent 
                            key={reply.id} 
                            comment={reply} 
                            onDelete={handleDeleteReply} 
                            onEdit={handleEditReply}
                            onViewProfile={onViewProfile} 
                        />
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
                    ))}
                </div>
            )}
        </Card>
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <EditFormComponent
                initialContent={post.content}
                onSave={handleSaveEdit}
                onCancel={() => setIsEditing(false)}
            />
        </Dialog>
        </>
    )
}

const CreatePost = ({ onPostCreated, repostContent = null }: { onPostCreated: () => void, repostContent?: Post | null }) => {
    const { user } = useAuth();
    const [newPostContent, setNewPostContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();
    const isMobile = useIsMobile();

    useEffect(() => {
        if (repostContent) {
            setNewPostContent(''); // Clear any existing text
            setIsDialogOpen(true);
        }
    }, [repostContent]);


    if (!user) return null;

     const handlePostSubmit = async () => {
        if (!user || (!newPostContent.trim() && !repostContent)) return;
        setIsSubmitting(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { postCount: increment(1) });
            
            if (repostContent) {
                const originalPostRef = doc(db, 'communityPosts', repostContent.id);
                await updateDoc(originalPostRef, { repostCount: increment(1) });
            }

            await addDoc(collection(db, 'communityPosts'), {
                authorId: user.uid,
                authorName: user.displayName,
                authorPhotoURL: user.photoURL,
                content: newPostContent.trim(),
                createdAt: serverTimestamp(),
                likes: [],
                likeCount: 0,
                repostCount: 0,
                shareCount: 0,
                ...(repostContent && { 
                    repostOf: repostContent.id, 
                    originalAuthorName: repostContent.authorName,
                    originalContent: repostContent.content
                })
            });
            setNewPostContent('');
            setIsDialogOpen(false);
            onPostCreated();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Failed to create post.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const DialogBody = (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{repostContent ? 'Add your thoughts' : 'Create Post'}</DialogTitle>
            </DialogHeader>
             {repostContent && (
                <Card className="bg-muted">
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={repostContent.authorPhotoURL || undefined} />
                            <AvatarFallback>{getInitials(repostContent.authorName)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm">{repostContent.authorName}</p>
                            <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(repostContent.createdAt.toDate(), { addSuffix: true })}
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                         <p className="text-sm text-muted-foreground line-clamp-3">{repostContent.content}</p>
                    </CardContent>
                </Card>
             )}
            <div className="py-4">
                <Textarea 
                    placeholder="Share your thoughts..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    rows={5}
                />
            </div>
            <DialogFooter>
                <Button onClick={handlePostSubmit} disabled={isSubmitting || (!newPostContent.trim() && !repostContent)} className="w-full">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Post
                </Button>
            </DialogFooter>
        </DialogContent>
    );

    // For mobile sticky footer
    if (isMobile) {
        return (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 z-20">
                    <Card>
                        <CardContent className="p-2 flex items-center gap-2">
                             <Avatar className="h-9 w-9">
                                <AvatarImage src={user.photoURL || undefined} />
                                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <DialogTrigger asChild>
                                <div className="flex-1 h-10 rounded-full bg-muted hover:bg-muted/80 cursor-pointer flex items-center px-4 text-muted-foreground text-sm">
                                    What's on your mind?
                                </div>
                            </DialogTrigger>
                            <Button onClick={() => setIsDialogOpen(true)} size="icon"><Send className="h-4 w-4" /></Button>
                        </CardContent>
                    </Card>
                </div>
                {DialogBody}
            </Dialog>
        )
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Card>
                <CardContent className="p-4 flex items-center gap-4">
                     <Avatar>
                        <AvatarImage src={user.photoURL || undefined} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <DialogTrigger asChild>
                        <div className="flex-1 h-10 rounded-full bg-muted hover:bg-muted/80 cursor-pointer flex items-center px-4 text-muted-foreground">
                            What's on your mind, {user.displayName?.split(' ')[0]}?
                        </div>
                    </DialogTrigger>
                    <Button onClick={() => setIsDialogOpen(true)}><Send className="h-4 w-4" /></Button>
                </CardContent>
            </Card>
            {DialogBody}
        </Dialog>
    )
}

const LoadingSkeleton = () => (
    <Card>
        <CardHeader className="flex flex-row items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
            </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
        </CardContent>
    </Card>
)

export default function CommunityPage() {
    const { user, hasPermission, loading: authLoading } = useAuth();
    const [allPosts, setAllPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [repostContent, setRepostContent] = useState<Post | null>(null);
    const [viewingUser, setViewingUser] = useState<User | null>(null);
    const [viewingUserStats, setViewingUserStats] = useState({ posts: 0, comments: 0 });
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const [newPostCount, setNewPostCount] = useState(0);
    const feedRef = useRef<HTMLDivElement>(null);
    
    const canViewPage = hasPermission('viewCommunityPage');

    useEffect(() => {
        if (authLoading) return;
        if (!user || !canViewPage) {
            setLoadingPosts(false);
            return;
        };

        let isInitialLoad = true;
        const postsQuery = query(collection(db, 'communityPosts'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(postsQuery, snapshot => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as Post));

            if (!isInitialLoad && feedRef.current && feedRef.current.scrollTop > 100) {
                 const newPosts = fetchedPosts.filter(p => !allPosts.some(op => op.id === p.id));
                 if(newPosts.length > 0) {
                    setNewPostCount(prev => prev + newPosts.length);
                 }
            }

            setAllPosts(fetchedPosts);
            setLoadingPosts(false);
            isInitialLoad = false;
        }, (error) => {
            console.error("Firestore error:", error);
            if (error.code === 'permission-denied') {
                toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to view the community feed.' });
            } else {
                toast({ variant: 'destructive', title: 'Could not load community feed.', description: 'Please check your connection and try again.' });
            }
            setLoadingPosts(false);
        });

        return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, toast, canViewPage]);
    
    const sortedPosts = useMemo(() => {
        return [...allPosts].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });
    }, [allPosts]);
    
    const handleViewProfile = async (userId: string) => {
        if (!userId) return;
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = { id: userDoc.id, ...userDoc.data() } as User;
                setViewingUser(userData);

                // Fetch stats
                const commentsQuery = query(collectionGroup(db, 'replies'), where('authorId', '==', userId));
                const commentsSnapshot = await getCountFromServer(commentsQuery);
                
                setViewingUserStats({
                    posts: userData.postCount || 0,
                    comments: commentsSnapshot.data().count
                });

            } else {
                toast({ variant: 'destructive', title: 'User not found.' });
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            toast({ variant: 'destructive', title: 'Could not fetch user profile.' });
        }
    };

    const handleRepost = (post: Post) => {
        setRepostContent(post);
    }
    
    const handlePin = async (post: Post) => {
        if (!hasPermission('manageCommunity')) {
            toast({ variant: 'destructive', title: 'Permission Denied' });
            return;
        }
        const postRef = doc(db, 'communityPosts', post.id);
        await updateDoc(postRef, { isPinned: !post.isPinned });
        toast({ title: post.isPinned ? 'Post unpinned' : 'Post pinned' });
    }

    const scrollToTop = () => {
        if (feedRef.current) {
            feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            setNewPostCount(0);
        }
    };
    
    const isLoading = authLoading || loadingPosts;
    
    if (authLoading) {
        return <div>Loading...</div>; // Or a proper loading skeleton for the whole page
    }

    if (!canViewPage) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to view this page.</AlertDescription>
            </Alert>
        );
    }


    return (
        <div className="bg-muted/40 min-h-screen">
<<<<<<< HEAD
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-screen-2xl mx-auto">
                <aside className="hidden lg:block lg:col-span-3">
                   <div className="sticky top-20 space-y-4">
                     <CommunityStatsSidebar />
=======
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <aside className="hidden lg:block lg:col-span-3">
                   <div className="sticky top-0 space-y-4">
                     <CommunityStatsSidebar />
                     <AnnouncementCard />
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
                   </div>
                </aside>
                
                <main className="col-span-12 lg:col-span-6 space-y-6 pb-20 lg:pb-6" ref={feedRef}>
                    {user && (
<<<<<<< HEAD
                        <div className="sticky top-[70px] z-10 hidden lg:block">
=======
                        <div className="sticky top-0 z-10 hidden lg:block">
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
                            <CreatePost onPostCreated={() => {}} repostContent={repostContent} />
                        </div>
                    )}

                    {newPostCount > 0 && (
<<<<<<< HEAD
                        <div className="sticky top-[150px] z-10 flex justify-center">
=======
                        <div className="sticky top-20 z-10 flex justify-center">
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
                            <Button onClick={scrollToTop} className="shadow-lg">
                                Show {newPostCount} new post{newPostCount > 1 ? 's' : ''}
                            </Button>
                        </div>
                    )}

                    <div className="space-y-4 px-4 lg:px-0">
                        {isLoading ? (
                            <>
                                <LoadingSkeleton />
                                <LoadingSkeleton />
                                <LoadingSkeleton />
                            </>
                        ) : sortedPosts.map(post => (
                            <PostCard key={post.id} post={post} onRepost={handleRepost} onPin={handlePin} onViewProfile={handleViewProfile} />
                        ))}
                    </div>
                     {user && isMobile && (
                        <div className="lg:hidden">
                            <CreatePost onPostCreated={() => {}} repostContent={repostContent} />
                        </div>
                    )}
                </main>

                <aside className="hidden lg:block lg:col-span-3">
<<<<<<< HEAD
                    <div className="sticky top-20 space-y-4">
=======
                    <div className="sticky top-0 space-y-4">
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
                      {user && <UserProfileSidebar user={user} />}
                    </div>
                </aside>
            </div>

            <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>User Profile</DialogTitle>
                    </DialogHeader>
                    {viewingUser && (
                        <div className="flex flex-col items-center text-center gap-4 py-4">
                            <Avatar className="h-24 w-24">
                                <AvatarImage src={viewingUser.photoURL || undefined} />
                                <AvatarFallback className="text-4xl">{getInitials(viewingUser.displayName)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="text-xl font-bold">{viewingUser.displayName}</h3>
                                <p className="text-muted-foreground">{viewingUser.email}</p>
                                {viewingUser.campus && <p className="text-sm text-muted-foreground">Campus: {viewingUser.campus}</p>}
                                {viewingUser.classLadder && <p className="text-sm text-muted-foreground">Ladder: {viewingUser.classLadder}</p>}
                                <div className="flex justify-center gap-4 mt-4 text-sm">
                                    <div className="text-center">
                                        <p className="font-bold text-lg">{viewingUserStats.posts}</p>
                                        <p className="text-muted-foreground">Posts</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-lg">{viewingUserStats.comments}</p>
                                        <p className="text-muted-foreground">Comments</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setViewingUser(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
