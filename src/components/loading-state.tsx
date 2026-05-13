"use client";

import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingState({ 
  message = "Loading your experience...", 
  fullScreen = true,
  className
}: LoadingStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8",
      fullScreen ? "fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md" : "w-full h-full min-h-[200px]",
      className
    )}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        {/* App Logo */}
        {fullScreen && (
          <motion.div 
            className="mb-12 scale-150"
            animate={{ 
              filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Logo />
          </motion.div>
        )}

        {/* Animated Loader */}
        <div className="relative flex items-center justify-center w-24 h-24 mb-8">
          {/* Outer glowing rings */}
          <motion.div
            className="absolute inset-0 border-2 border-primary/10 rounded-full"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0 border-4 border-primary/20 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-0 border-t-4 border-primary rounded-full shadow-[0_0_20px_rgba(var(--primary),0.6)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />

          {/* Rolling / Morphing Box */}
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-lg shadow-xl shadow-primary/40"
            animate={{
              rotate: [0, 90, 180, 270, 360],
              borderRadius: ["20%", "50%", "20%", "50%", "20%"],
              scale: [1, 1.2, 0.9, 1.2, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Animated Text */}
        <div className="flex flex-col items-center gap-4">
            <motion.div 
              className="flex items-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-primary rounded-full"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity, 
                    delay: i * 0.2 
                  }}
                />
              ))}
            </motion.div>
            
            <div className="flex flex-col items-center gap-2">
                <motion.p
                  className="text-xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-white bg-[length:200%_auto] tracking-widest uppercase text-center"
                  animate={{ 
                    backgroundPosition: ["200% 0", "-200% 0"],
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  {message}
                </motion.p>
                <motion.div 
                    className="h-0.5 bg-primary/10 rounded-full overflow-hidden w-64"
                >
                    <motion.div 
                        className="h-full bg-gradient-to-r from-transparent via-primary to-transparent"
                        animate={{ 
                            x: ["-100%", "100%"]
                        }}
                        transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                        }}
                    />
                </motion.div>
            </div>
        </div>
      </motion.div>

      {/* Decorative background effects for full screen */}
      {fullScreen && (
        <>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary),0.05),transparent_70%)] pointer-events-none" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
        </>
      )}
    </div>
  );
}
