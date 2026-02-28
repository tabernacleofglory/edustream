
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, increment, arrayUnion, arrayRemove, where, getDocs, getDoc, collectionGroup, getCountFromServer } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Heart, MessageSquare, Trash2, Send, Repeat2, Pin, Share2, Edit, Lock, Plus, Smile, ImageIcon, FileText, X, Link2, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { User, Post, Ladder } from '@/lib/types';
import CommunityStatsSidebar from '@/components/community-stats-sidebar';
import UserProfileSidebar from '@/components/user-profile-sidebar';
import ReactPlayer from 'react-player';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker from 'emoji-picker-react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/hooks/use-i18n';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map((n) => n[0]).join("").toUpperCase();
};

const EditFormComponent = ({ initialContent, onSave, onCancel, type = 'Post' }: { initialContent: string, onSave: (newContent: string) => Promise<void>, onCancel: () => void, type?: 'Post' | 'Comment' }) => {
    const [content, setContent] = useState(initialContent);
    const [isSaving, setIsSaving] = useState(false);
    const { t } = useI18n();

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(content);
        setIsSaving(false);
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('course.action.edit', 'Edit')} {type}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>{t('course.alert.cancel', 'Cancel')}</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('settings.button.save', 'Save Changes')}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

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
    const { t } = useI18n();
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
                <div className="prose prose-sm dark:prose-invert max-w-none mt-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {comment.content}
                    </ReactMarkdown>
                </div>
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


const ReplyFormComponent = ({ parentComment, onReplyPosted, onCancel }: { parentComment: Post, onReplyPosted: () => void, onCancel: () => void }) => {
    const [replyText, setReplyText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { t } = useI18n();
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
            toast({ variant: 'destructive', title: t('community.create.error', 'Failed to create post.') });
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
                    placeholder={t('community.reply.placeholder', 'Replying to {{name}}...').replace('{{name}}', parentComment.authorName)}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full text-sm"
                    rows={2}
                    disabled={isSubmitting}
                />
                <div className="flex justify-end items-center mt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t('community.reply.cancel', 'Cancel')}</Button>
                    <Button type="submit" size="sm" disabled={isSubmitting || !replyText.trim()}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('community.reply.button', 'Reply')}
                    </Button>
                </div>
            </div>
        </form>
    );
};


const AttachmentList = ({ attachments }: { attachments: { url: string, type: 'image' | 'document', name: string }[] }) => {
    const images = attachments.filter(a => a.type === 'image');
    const docs = attachments.filter(a => a.type === 'document');

    return (
        <div className="space-y-4 mt-4">
            {images.length > 0 && (
                images.length > 1 ? (
                    <Carousel className="w-full" opts={{ align: "start" }}>
                        <CarouselContent>
                            {images.map((img, idx) => (
                                <CarouselItem key={idx}>
                                    <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
                                        <Image src={img.url} alt={img.name || "post image"} fill className="object-contain" />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <div className="hidden sm:block">
                            <CarouselPrevious className="left-2" />
                            <CarouselNext className="right-2" />
                        </div>
                    </Carousel>
                ) : (
                    <div className="relative aspect-video rounded-lg overflow-hidden border bg-muted">
                        <Image src={images[0].url} alt={images[0].name || "post image"} fill className="object-contain" />
                    </div>
                )
            )}

            {docs.length > 0 && (
                <div className="space-y-2">
                    {docs.map((doc, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className="h-8 w-8 text-primary shrink-0" />
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium truncate">{doc.name}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Document</p>
                                </div>
                            </div>
                            <Button asChild variant="outline" size="sm">
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                </a>
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const PostCard = ({ post, onRepost, onPin, onViewProfile, onEdit }: { 
    post: Post, 
    onRepost: (post: Post) => void, 
    onPin: (post: Post) => void, 
    onViewProfile: (userId: string) => void,
    onEdit: (post: Post) => void
}) => {
    const { user, hasPermission } = useAuth();
    const { t } = useI18n();
    const { toast } = useToast();
    const [replies, setReplies] = useState<Post[]>([]);
    const [isReplying, setIsReplying] = useState(false);
    
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
        if(window.confirm(t('community.post.delete_confirm', 'Are you sure you want to delete this post?'))) {
            await deleteDoc(doc(db, 'communityPosts', post.id));
            toast({ title: 'Post deleted.' });
        }
    }
    
     const handleDeleteReply = async (reply: Post) => {
        if (!hasPermission('manageCommunity') && user?.uid !== reply.authorId) {
            toast({ variant: 'destructive', title: 'You do not have permission to delete this reply.' });
            return;
        }
        if (window.confirm(t('community.post.delete_reply_confirm', 'Are you sure you want to delete this reply?'))) {
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

    const handleShare = async () => {
        const shareData = {
            title: `Post by ${post.authorName}`,
            text: post.content,
            url: window.location.href, 
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                 navigator.clipboard.writeText(shareData.url);
                 toast({ title: t('community.post.share_success', "Link copied to clipboard") });
            }
            const postRef = doc(db, 'communityPosts', post.id);
            await updateDoc(postRef, { shareCount: increment(1) });

        } catch (err) {
            console.log("Share failed, falling back to clipboard", err);
            navigator.clipboard.writeText(shareData.url);
            toast({ title: t('community.post.share_success', "Link copied to clipboard") });
        }
    };

    const userHasLiked = user ? post.likes?.includes(user.uid) : false;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const firstUrl = post.content.match(urlRegex)?.[0];

    return (
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
                    <Button variant="ghost" size="icon" onClick={() => onEdit(post)} className="text-muted-foreground hover:text-primary h-7 w-7">
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
                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                            a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props} />
                        }}
                    >
                        {post.content}
                    </ReactMarkdown>
                </div>
                
                {post.attachments && post.attachments.length > 0 && (
                    <AttachmentList attachments={post.attachments} />
                )}

                {post.links && post.links.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {post.links.map((link, idx) => (
                            <Button key={idx} asChild variant="outline" size="sm" className="rounded-full">
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                    <Link2 className="mr-2 h-3 w-3" />
                                    {link.label}
                                </a>
                            </Button>
                        ))}
                    </div>
                )}
                {post.repostOf && post.originalContent && (
                    <div className="mt-4 p-3 bg-muted/30 border rounded-md">
                        <p className="text-xs font-semibold mb-2">{post.originalAuthorName}</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-3">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {post.originalContent}
                            </ReactMarkdown>
                        </div>
                        
                        {post.originalAttachments && post.originalAttachments.length > 0 && (
                            <AttachmentList attachments={post.originalAttachments} />
                        )}

                        {post.originalLinks && post.originalLinks.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {post.originalLinks.map((link, idx) => (
                                    <Button key={idx} asChild variant="outline" size="sm" className="h-7 text-[10px] px-2 rounded-full">
                                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                                            <Link2 className="mr-1 h-3 w-3" />
                                            {link.label}
                                        </a>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
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
                        <CommentComponent 
                            key={reply.id} 
                            comment={reply} 
                            onDelete={handleDeleteReply} 
                            onEdit={handleEditReply}
                            onViewProfile={onViewProfile} 
                        />
                    ))}
                </div>
            )}
        </Card>
    )
}

const CommunityPostEditor = ({ 
    isOpen, 
    onOpenChange, 
    onPostCreated, 
    mode = 'create', 
    targetPost = null 
}: { 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    onPostCreated: () => void, 
    mode?: 'create' | 'edit' | 'repost', 
    targetPost?: Post | null 
}) => {
    const { user } = useAuth();
    const { t } = useI18n();
    const [newPostContent, setNewPostContent] = useState('');
    const [postLinks, setPostLinks] = useState<{url: string, label: string, id: string}[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachments, setAttachments] = useState<{file: File, type: 'image' | 'document', id: string}[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<{url: string, type: 'image' | 'document', name: string}[]>([]);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkLabel, setLinkLabel] = useState('');
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const isMobile = useIsMobile();

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && targetPost) {
                setNewPostContent(targetPost.content || '');
                setPostLinks(targetPost.links?.map(l => ({ ...l, id: uuidv4() })) || []);
                setExistingAttachments(targetPost.attachments || []);
                setAttachments([]);
            } else {
                setNewPostContent('');
                setPostLinks([]);
                setAttachments([]);
                setExistingAttachments([]);
            }
        }
    }, [isOpen, mode, targetPost]);

     const handlePostSubmit = async () => {
        if (!user || (!newPostContent.trim() && mode !== 'edit' && attachments.length === 0 && postLinks.length === 0)) return;
        setIsSubmitting(true);
        try {
            const uploadedAttachments = [];
            for (const att of attachments) {
                const storageRef = ref(storage, `community/${user.uid}/${att.id}-${att.file.name}`);
                await uploadBytes(storageRef, att.file);
                const url = await getDownloadURL(storageRef);
                uploadedAttachments.push({
                    url,
                    type: att.type,
                    name: att.file.name
                });
            }

            if (mode === 'edit' && targetPost) {
                const postRef = doc(db, 'communityPosts', targetPost.id);
                await updateDoc(postRef, {
                    content: newPostContent.trim(),
                    links: postLinks.map(l => ({ url: l.url, label: l.label })),
                    attachments: [...existingAttachments, ...uploadedAttachments],
                    updatedAt: serverTimestamp(),
                });
                toast({ title: t('settings.button.save', 'Post Updated') });
            } else {
                if (mode === 'repost' && targetPost) {
                    const originalPostRef = doc(db, 'communityPosts', targetPost.id);
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
                    attachments: uploadedAttachments,
                    links: postLinks.map(l => ({ url: l.url, label: l.label })),
                    ...(mode === 'repost' && targetPost && { 
                        repostOf: targetPost.id, 
                        originalAuthorName: targetPost.authorName,
                        originalContent: targetPost.content,
                        originalLinks: targetPost.links || [],
                        originalAttachments: targetPost.attachments || []
                    })
                });
                toast({ title: t('community.create.success', 'Post created successfully!') });
            }
            
            if (mode === 'create' || mode === 'repost') {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, { postCount: increment(1) });
            }

            onPostCreated();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: t('community.create.error', 'Failed to create post.') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const addAttachment = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                file,
                type,
                id: uuidv4()
            }));
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const handleAddLink = () => {
        if (!linkUrl) return;
        const formattedUrl = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
        
        if (!linkLabel.trim()) {
            setNewPostContent(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + formattedUrl + ' ');
        } else {
            setPostLinks(prev => [...prev, { url: formattedUrl, label: linkLabel.trim(), id: uuidv4() }]);
        }
        
        setLinkUrl('');
        setLinkLabel('');
        setIsLinkPopoverOpen(false);
    };
    
    const FormContent = (
        <div className="flex flex-col h-full gap-4 py-4">
             {mode === 'repost' && targetPost && (
                <Card className="bg-muted">
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={targetPost.authorPhotoURL || undefined} />
                            <AvatarFallback>{getInitials(targetPost.authorName)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm">{targetPost.authorName}</p>
                            <p className="text-xs text-muted-foreground">
                                {targetPost.createdAt ? formatDistanceToNow(targetPost.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                         <div className="prose prose-sm dark:prose-invert max-none line-clamp-3">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {targetPost.content}
                            </ReactMarkdown>
                         </div>
                    </CardContent>
                </Card>
             )}
            <div className="flex-1">
                <Textarea 
                    placeholder={t('community.create.placeholder', 'Share your thoughts...')}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="min-h-[200px] h-full resize-none text-lg border-none focus-visible:ring-0 p-0"
                />
            </div>

            {(attachments.length > 0 || existingAttachments.length > 0) && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {existingAttachments.map(att => (
                        <div key={att.url} className="relative group">
                            {att.type === 'image' ? (
                                <div className="relative h-20 w-20">
                                    <Image src={att.url} alt="preview" fill className="object-cover rounded-md" />
                                </div>
                            ) : (
                                <div className="h-20 w-20 flex items-center justify-center bg-muted rounded-md text-[10px] p-1 break-all overflow-hidden border">
                                    {att.name}
                                </div>
                            )}
                            <button 
                                onClick={() => setExistingAttachments(prev => prev.filter(a => a.url !== att.url))}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    {attachments.map(att => (
                        <div key={att.id} className="relative group">
                            {att.type === 'image' ? (
                                <div className="relative h-20 w-20">
                                    <Image src={URL.createObjectURL(att.file)} alt="preview" fill className="object-cover rounded-md" />
                                </div>
                            ) : (
                                <div className="h-20 w-20 flex items-center justify-center bg-muted rounded-md text-[10px] p-1 break-all overflow-hidden border">
                                    {att.file.name}
                                </div>
                            )}
                            <button 
                                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {postLinks.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {postLinks.map(link => (
                        <Badge key={link.id} variant="secondary" className="pl-3 pr-1 py-1 gap-2">
                            <Link2 className="h-3 w-3" />
                            {link.label}
                            <button onClick={() => setPostLinks(prev => prev.filter(l => l.id !== link.id))} className="hover:bg-muted-foreground/20 rounded-full p-0.5">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center gap-1">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full">
                                <Smile className="h-6 w-6" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none shadow-2xl" side="top" align="start">
                            <EmojiPicker onEmojiClick={(emojiData) => setNewPostContent(prev => prev + emojiData.emoji)} />
                        </PopoverContent>
                    </Popover>
                    
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                        onClick={() => imageInputRef.current?.click()}
                    >
                        <ImageIcon className="h-6 w-6" />
                    </Button>
                    <input 
                        type="file" 
                        ref={imageInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        onChange={(e) => addAttachment(e, 'image')} 
                    />

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FileText className="h-6 w-6" />
                    </Button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".pdf,.doc,.docx,.txt" 
                        multiple 
                        onChange={(e) => addAttachment(e, 'document')} 
                    />

                    <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                            >
                                <Link2 className="h-6 w-6" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" side="top" align="start">
                            <div className="space-y-4">
                                <h4 className="font-medium leading-none">{t('community.create.insert_link', 'Insert Link')}</h4>
                                <div className="space-y-2">
                                    <Label htmlFor="link-url">{t('community.create.label_url', 'URL')}</Label>
                                    <Input 
                                        id="link-url" 
                                        placeholder="https://example.com" 
                                        value={linkUrl}
                                        onChange={e => setLinkUrl(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="link-label">{t('community.create.label_label', 'Label (Optional)')}</Label>
                                    <Input 
                                        id="link-label" 
                                        placeholder="Click here" 
                                        value={linkLabel}
                                        onChange={e => setLinkLabel(e.target.value)}
                                    />
                                </div>
                                <Button className="w-full" onClick={handleAddLink} disabled={!linkUrl}>{t('community.create.add_link', 'Add Link')}</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                <Button onClick={handlePostSubmit} disabled={isSubmitting || (!newPostContent.trim() && mode !== 'edit' && attachments.length === 0 && postLinks.length === 0)} className={cn("w-full md:w-auto h-12 text-lg rounded-full")}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === 'edit' ? t('settings.button.save', 'Update') : t('community.create.button', 'Post')}
                </Button>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <Sheet open={isOpen} onOpenChange={onOpenChange}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-[2rem] px-6">
                    <SheetHeader className="text-left">
                        <SheetTitle>
                            {mode === 'edit' ? t('course.action.edit', 'Edit') : 
                             mode === 'repost' ? t('community.create.repost_title', 'Add your thoughts') : 
                             t('community.create.title', 'Create Post')}
                        </SheetTitle>
                        <SheetDescription className="sr-only">Share an update with the community</SheetDescription>
                    </SheetHeader>
                    {FormContent}
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'edit' ? t('course.action.edit', 'Edit') : 
                         mode === 'repost' ? t('community.create.repost_title', 'Add your thoughts') : 
                         t('community.create.title', 'Create Post')}
                    </DialogTitle>
                </DialogHeader>
                {FormContent}
            </DialogContent>
        </Dialog>
    )
}

const PostEditorTrigger = ({ user, onClick }: { user: User | null, onClick: () => void }) => {
    const { t } = useI18n();
    if (!user) return null;
    return (
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={onClick}>
            <CardContent className="p-4 flex items-center gap-4">
                 <Avatar>
                    <AvatarImage src={user.photoURL || undefined} />
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 h-10 rounded-full bg-muted flex items-center px-4 text-muted-foreground text-sm">
                    {t('community.create.placeholder', "Share your thoughts...")}
                </div>
                <Button variant="ghost" size="icon"><Send className="h-4 w-4" /></Button>
            </CardContent>
        </Card>
    );
};

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
    const { t } = useI18n();
    const [allPosts, setAllPosts] = useState<Post[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'repost'>('create');
    const [targetPost, setTargetPost] = useState<Post | null>(null);
    const [viewingUser, setViewingUser] = useState<User | null>(null);
    const [viewingUserStats, setViewingUserStats] = useState({ posts: 0, comments: 0 });
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const [newPostCount, setNewPostCount] = useState(0);
    const feedRef = useRef<HTMLDivElement>(null);
    
    const canViewPage = hasPermission('viewCommunityPage');

    const handleOpenEditor = (mode: 'create' | 'edit' | 'repost', post: Post | null = null) => {
        setEditorMode(mode);
        setTargetPost(post);
        setIsEditorOpen(true);
    };

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
        return <div>Loading...</div>; 
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <aside className="hidden lg:block lg:col-span-3">
                   <div className="sticky top-0 space-y-4">
                     <CommunityStatsSidebar />
                   </div>
                </aside>
                
                <main className="col-span-12 lg:col-span-6 space-y-6 pb-20 lg:pb-6" ref={feedRef}>
                    {user && (
                        <div className="sticky top-0 z-10 hidden lg:block">
                            <PostEditorTrigger user={user} onClick={() => handleOpenEditor('create')} />
                        </div>
                    )}

                    {newPostCount > 0 && (
                        <div className="sticky top-20 z-10 flex justify-center">
                            <Button onClick={scrollToTop} className="shadow-lg">
                                {t('community.feed.new_posts', 'Show {{count}} new posts').replace('{{count}}', String(newPostCount))}
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
                            <PostCard 
                                key={post.id} 
                                post={post} 
                                onRepost={(p) => handleOpenEditor('repost', p)} 
                                onPin={handlePin} 
                                onViewProfile={handleViewProfile}
                                onEdit={(p) => handleOpenEditor('edit', p)}
                            />
                        ))}
                    </div>
                     {user && isMobile && (
                        <Button 
                            size="icon" 
                            onClick={() => handleOpenEditor('create')}
                            className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-2xl z-30 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <Plus className="h-6 w-6" />
                        </Button>
                    )}
                </main>

                <aside className="hidden lg:block lg:col-span-3">
                    <div className="sticky top-0 space-y-4">
                      {user && <UserProfileSidebar user={user} />}
                    </div>
                </aside>
            </div>

            <CommunityPostEditor 
                isOpen={isEditorOpen} 
                onOpenChange={setIsEditorOpen} 
                onPostCreated={() => {}} 
                mode={editorMode} 
                targetPost={targetPost} 
            />

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
