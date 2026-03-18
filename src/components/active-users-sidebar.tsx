"use client";

import { useState, useEffect, useRef } from "react";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    orderBy,
    limit,
    Timestamp,
    addDoc,
    serverTimestamp,
    deleteDoc,
    doc,
    updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, Globe, Loader2, Users, Clock, ArrowLeft, Send, Edit, Trash2, Check, X } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "./ui/input";

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase();
};

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    createdAt: any;
}

const ChatView = ({ targetUser, onBack }: { targetUser: User, onBack: () => void }) => {
    const { user: admin } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Create a stable chat ID between these two users
    const chatId = (admin?.uid && targetUser.id) ? [admin.uid, targetUser.id].sort().join("_") : null;

    useEffect(() => {
        if (!chatId) return;

        const q = query(
            collection(db, "livechats", chatId, "messages"),
            orderBy("createdAt", "asc"),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);
            // Scroll to bottom
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }, (error) => {
            console.error("Chat snapshot error:", error);
        });

        return () => unsubscribe();
    }, [chatId]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !admin || !chatId || isSending) return;

        setIsSending(true);
        try {
            await addDoc(collection(db, "livechats", chatId, "messages"), {
                senderId: admin.uid,
                senderName: admin.displayName,
                text: newMessage.trim(),
                createdAt: serverTimestamp(),
            });
            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (!chatId) return;
        try {
            await deleteDoc(doc(db, "livechats", chatId, "messages", msgId));
        } catch (error) {
            console.error("Error deleting message:", error);
        }
    };

    const handleUpdateMessage = async (msgId: string) => {
        if (!chatId || !editingText.trim()) return;
        try {
            await updateDoc(doc(db, "livechats", chatId, "messages", msgId), {
                text: editingText.trim(),
                updatedAt: serverTimestamp(),
            });
            setEditingMessageId(null);
            setEditingText("");
        } catch (error) {
            console.error("Error updating message:", error);
        }
    };

    const startEditing = (msg: Message) => {
        setEditingMessageId(msg.id);
        setEditingText(msg.text);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex items-center gap-3 p-4 border-b bg-muted/20">
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                    <AvatarImage src={targetUser.photoURL || undefined} />
                    <AvatarFallback>{getInitials(targetUser.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{targetUser.displayName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{targetUser.campus || 'No Campus'}</p>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((msg) => {
                        const isMe = msg.senderId === admin?.uid;
                        const isEditing = editingMessageId === msg.id;
                        return (
                            <div key={msg.id} className={cn("flex flex-col group", isMe ? "items-end" : "items-start")}>
                                <div className={cn("flex items-center gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                                    <div className={cn(
                                        "max-w-[200px] sm:max-w-[250px] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                        isMe 
                                            ? "bg-primary text-primary-foreground rounded-tr-none" 
                                            : "bg-muted text-foreground rounded-tl-none"
                                    )}>
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <Input 
                                                    value={editingText} 
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    className="h-7 text-xs bg-white text-black"
                                                    autoFocus
                                                />
                                                <div className="flex gap-1 justify-end">
                                                    <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-white/20" onClick={() => handleUpdateMessage(msg.id)}>
                                                        <Check className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-5 w-5 hover:bg-white/20" onClick={() => setEditingMessageId(null)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                    {isMe && !isEditing && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditing(msg)}>
                                                <Edit className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteMessage(msg.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <span className="text-[9px] text-muted-foreground mt-1 px-1">
                                    {msg.createdAt ? format(msg.createdAt.toDate(), 'p') : '...'}
                                </span>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <form onSubmit={handleSendMessage} className="p-4 border-t bg-muted/10 flex gap-2">
                <Input 
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isSending}
                    className="rounded-full"
                />
                <Button 
                    type="submit" 
                    size="icon" 
                    disabled={!newMessage.trim() || isSending}
                    className="rounded-full shrink-0"
                >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
            </form>
        </div>
    );
};

export default function ActiveUsersSidebar() {
    const [activeUsers, setActiveUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUserForChat, setSelectedUserForChat] = useState<User | null>(null);
    const { user: admin, isCurrentUserAdmin } = useAuth();

    useEffect(() => {
        if (!isCurrentUserAdmin || !admin) return;

        // active in last 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        const q = query(
            collection(db, "users"),
            where("lastActiveAt", ">=", Timestamp.fromDate(tenMinutesAgo)),
            orderBy("lastActiveAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setActiveUsers(usersList);
            setLoading(false);
        }, (error) => {
            console.error("Active users snapshot error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isCurrentUserAdmin, admin, db]);

    if (!isCurrentUserAdmin) return null;

    return (
        <Sheet onOpenChange={(open) => { if (!open) setSelectedUserForChat(null); }}>
            <div className="fixed right-0 top-1/2 -translate-y-1/2 z-[100] group hidden md:block">
                <SheetTrigger asChild>
                    <Button 
                        variant="outline" 
                        className="h-24 w-6 px-0 rounded-l-xl rounded-r-none border-r-0 opacity-20 group-hover:opacity-100 transition-all bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl border-primary/20"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </SheetTrigger>
            </div>

            <SheetContent side="right" className="w-[350px] sm:max-w-md flex flex-col p-0 overflow-hidden">
                {selectedUserForChat ? (
                    <ChatView 
                        targetUser={selectedUserForChat} 
                        onBack={() => setSelectedUserForChat(null)} 
                    />
                ) : (
                    <>
                        <SheetHeader className="p-6 border-b bg-muted/30">
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                <SheetTitle>Active Users</SheetTitle>
                            </div>
                            <SheetDescription>
                                Click on a user to start a live chat. Only users active within the last 10 minutes are shown.
                            </SheetDescription>
                        </SheetHeader>

                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-4">
                                {loading ? (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                ) : activeUsers.length > 0 ? (
                                    activeUsers.map(user => (
                                        <div 
                                            key={user.id} 
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group/item border border-transparent hover:border-border"
                                            onClick={() => setSelectedUserForChat(user)}
                                        >
                                            <Avatar className="h-10 w-10 border shadow-sm">
                                                <AvatarImage src={user.photoURL || undefined} />
                                                <AvatarFallback className="bg-primary/5 text-primary">{getInitials(user.displayName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-semibold text-sm truncate group-hover/item:text-primary transition-colors">{user.displayName}</p>
                                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" title="Online" />
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                                        {user.campus === 'All Campuses' && <Globe className="h-3 w-3 text-primary shrink-0" />}
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground/70 truncate">{user.campus || 'No Campus'}</span>
                                                    </div>
                                                    {user.lastActiveAt && (
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 ml-2">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {formatDistanceToNow(user.lastActiveAt.toDate(), { addSuffix: true })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Users className="h-12 w-12 mx-auto opacity-20 mb-4" />
                                        <p className="text-sm">No other users active right now.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t bg-muted/10">
                            <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-semibold">
                                {activeUsers.length} total active user{activeUsers.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
