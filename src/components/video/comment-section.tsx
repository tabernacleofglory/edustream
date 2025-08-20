
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection, addDoc, query, onSnapshot, orderBy, serverTimestamp,
  doc, deleteDoc, updateDoc, arrayUnion, arrayRemove
} from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseFirestore } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ThumbsUp, Reply, Pin, Trash2, Edit, Smile, Send, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import type { Comment } from '@/lib/types';
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../ui/dialog";


const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map((n) => n[0]).join("").toUpperCase();
};

const ReplyFormComponent = ({ parentComment, videoId, onReplyPosted, onCancel }: { parentComment: Comment, videoId: string, onReplyPosted: () => void, onCancel: () => void }) => {
    const [replyText, setReplyText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !user) return;
        setIsSubmitting(true);

        const replyData: Omit<Comment, 'id'> = {
            userId: user.uid,
            userName: user.displayName,
            userAvatar: user.photoURL,
            text: replyText.trim(),
            createdAt: serverTimestamp(),
            reactions: {},
            parentId: parentComment.id,
            parentAuthor: parentComment.userName,
        };

        try {
            await addDoc(collection(db, "Contents", videoId, "comments"), replyData);
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
                    placeholder={`Replying to ${parentComment.userName}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full text-sm"
                    rows={1}
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

const SingleComment = ({ 
    comment, 
    isModerator, 
    isAdmin, 
    onDelete, 
    onPin, 
    isPinned,
    replies,
    videoId,
}: { 
    comment: Comment, 
    isModerator: boolean,
    isAdmin: boolean,
    onDelete: (commentId: string) => void,
    onPin: (comment: Comment) => void,
    isPinned?: boolean
    replies: Comment[],
    videoId: string,
}) => {
    const { user } = useAuth();
    const [showActions, setShowActions] = useState(false);
    const [isReplying, setIsReplying] = useState(false);
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const likes = comment.reactions?.['👍'] || [];
    const userHasLiked = user ? likes.includes(user.uid) : false;

    const handleCommentLike = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to like comments.' });
            return;
        }
        const commentRef = doc(db, 'Contents', videoId, 'comments', comment.id);
        await updateDoc(commentRef, {
            'reactions.👍': userHasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
        });
    };
    
    return (
        <div 
            className="relative flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            {isPinned && <Pin className="h-4 w-4 text-amber-500 flex-shrink-0 mt-1" />}
            <Avatar className="h-8 w-8">
                <AvatarImage src={comment.userAvatar || undefined} />
                <AvatarFallback>{getInitials(comment.userName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{comment.userName}</span>
                    <span className="text-xs text-muted-foreground">
                        {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}
                    </span>
                </div>
                {comment.parentAuthor && (
                    <p className="text-xs text-muted-foreground">
                        Replying to <span className="font-semibold">@{comment.parentAuthor}</span>
                    </p>
                )}
                <p className="text-sm">{comment.text}</p>
                 <div className="flex items-center gap-1 mt-1">
                     <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground" onClick={handleCommentLike}>
                        <ThumbsUp className={cn("h-3 w-3 mr-1", userHasLiked && "fill-primary text-primary")} />
                        {likes.length > 0 && <span>{likes.length}</span>}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setIsReplying(prev => !prev)}>
                        <Reply className="h-3 w-3 mr-1" />
                        Reply
                    </Button>
                </div>

                {isReplying && (
                    <ReplyFormComponent parentComment={comment} videoId={videoId} onReplyPosted={() => setIsReplying(false)} onCancel={() => setIsReplying(false)} />
                )}

                {replies.length > 0 && (
                    <div className="mt-2 space-y-3 pl-4 border-l-2">
                        {replies.map(reply => (
                            <SingleComment 
                                key={reply.id} 
                                comment={reply} 
                                isModerator={isModerator}
                                isAdmin={isAdmin}
                                onDelete={onDelete}
                                onPin={onPin}
                                replies={[]}
                                videoId={videoId}
                            />
                        ))}
                    </div>
                )}
            </div>
             {showActions && (isModerator || isAdmin) && (
                <div className="absolute top-1 right-1 z-20 bg-background border rounded-lg shadow-lg flex">
                    {isModerator && (
                        <Button variant="ghost" size="icon" className="p-0 h-8 w-8" onClick={() => onPin(comment)}>
                            <Pin className="h-4 w-4" />
                        </Button>
                    )}
                    {isAdmin && (
                        <Button variant="ghost" size="icon" className="p-0 h-8 w-8 text-destructive" onClick={() => onDelete(comment.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export const CommentForm = ({ videoId }: { videoId: string }) => {
    const { user } = useAuth();
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const db = getFirebaseFirestore();

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !user) return;
        setIsSubmitting(true);

        const commentData: Omit<Comment, 'id' | 'replies'> = {
            userId: user.uid,
            userName: user.displayName,
            userAvatar: user.photoURL,
            text: newComment.trim(),
            createdAt: serverTimestamp(),
            reactions: {},
        };

        try {
            await addDoc(collection(db, "Contents", videoId, "comments"), commentData);
            setNewComment('');
            setIsDialogOpen(false); // Close dialog on mobile after post
        } catch(err) {
            console.error("Error posting comment: ", err);
            toast({ variant: 'destructive', title: 'Failed to post comment.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!user) return null;

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
                                    Add a comment...
                                </div>
                            </DialogTrigger>
                            <Button onClick={() => setIsDialogOpen(true)} size="icon"><Send className="h-4 w-4" /></Button>
                        </CardContent>
                    </Card>
                </div>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add a comment</DialogTitle>
                    </DialogHeader>
                     <form onSubmit={handleCommentSubmit}>
                        <div className="py-4">
                            <Textarea 
                                placeholder="Share your thoughts..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                rows={5}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting || !newComment.trim()} className="w-full">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Comment
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <form onSubmit={handleCommentSubmit} className="flex items-start gap-2 sticky bottom-0 bg-background p-4 border-t">
            <Avatar className="h-9 w-9">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full"
                    disabled={isSubmitting}
                />
                <div className="flex justify-end items-center mt-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" type="button"><Smile className="h-5 w-5 text-muted-foreground" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <EmojiPicker onEmojiClick={(emojiData: EmojiClickData) => setNewComment(prev => prev + emojiData.emoji)} />
                        </PopoverContent>
                    </Popover>
                    <Button type="submit" size="sm" disabled={isSubmitting || !newComment.trim()}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Comment
                    </Button>
                </div>
            </div>
        </form>
    );
};

export default function CommentSection({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [pinnedComment, setPinnedComment] = useState<Comment | null>(null);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  const isModerator = user?.role === 'admin' || user?.role === 'developer' || user?.charge === 'moderator';
  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  useEffect(() => {
    if (!videoId) return;

    const commentsColRef = collection(db, "Contents", videoId, "comments");
    const q = query(commentsColRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let commentsData: Comment[] = [];
      let pinned: Comment | null = null;
      querySnapshot.forEach((doc) => {
        const comment = { id: doc.id, ...doc.data() } as Comment;
        if (comment.isPinned) {
          pinned = comment;
        }
        commentsData.push(comment);
      });
      setComments(commentsData);
      setPinnedComment(pinned);
    });

    return () => unsubscribe();
  }, [videoId, db]);

  const handleTogglePin = async (comment: Comment) => {
    if (!isModerator) return;
    const commentRef = doc(db, "Contents", videoId, "comments", comment.id);
    await updateDoc(commentRef, { isPinned: !comment.isPinned });
    toast({ title: comment.isPinned ? "Comment unpinned" : "Comment pinned" });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isAdmin) return;
    if (window.confirm("Are you sure you want to delete this comment?")) {
      const commentRef = doc(db, "Contents", videoId, "comments", commentId);
      await deleteDoc(commentRef);
      toast({ title: "Comment deleted" });
    }
  };

  const commentTree = useMemo(() => {
    const commentMap: { [id: string]: Comment & { replies: Comment[] } } = {};
    const topLevelComments: (Comment & { replies: Comment[] })[] = [];

    for (const comment of comments) {
      commentMap[comment.id] = { ...comment, replies: [] };
    }

    for (const comment of comments) {
      if (comment.parentId && commentMap[comment.parentId]) {
        commentMap[comment.parentId].replies.push(commentMap[comment.id]);
      } else {
        topLevelComments.push(commentMap[comment.id]);
      }
    }

    const sortComments = (c: Comment[]) => c.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    topLevelComments.forEach(comment => {
        sortComments(comment.replies);
    });
    
    return topLevelComments.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  }, [comments]);

  return (
    <div className="mt-6 border-t pt-6">
      <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <MessageCircle />
        Live Chat ({comments.length})
      </h2>
      <div className="space-y-4 lg:mb-24">
        {pinnedComment && <SingleComment comment={pinnedComment} replies={[]} isPinned onDelete={handleDeleteComment} onPin={handleTogglePin} isModerator={isModerator} isAdmin={isAdmin} videoId={videoId}/>}
        {commentTree.map(comment => (
            comment.id !== pinnedComment?.id && <SingleComment key={comment.id} comment={comment} replies={comment.replies} onDelete={handleDeleteComment} onPin={handleTogglePin} isModerator={isModerator} isAdmin={isAdmin} videoId={videoId}/>
        ))}
      </div>
    </div>
  );
}
