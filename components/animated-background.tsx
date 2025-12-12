"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-primary/5 to-primary/10" />

      {/* Blueprint grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(150,24,24,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(150,24,24,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Construction tools floating - hero style */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 0.15, y: 0 }}
        transition={{
          opacity: { duration: 3, ease: "easeOut" },
          y: { duration: 3, ease: "easeOut" },
        }}
        className="absolute -top-24 -right-32 h-96 w-96 opacity-8"
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 140, repeat: Infinity, ease: "linear" }}
          className="relative h-full w-full"
        >
          <Image
            src="/background-svg/saw-svgrepo-com.svg"
            alt=""
            fill
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 0.15, y: 0 }}
        transition={{
          opacity: { duration: 3, delay: 0.5, ease: "easeOut" },
          y: { duration: 3, delay: 0.5, ease: "easeOut" },
        }}
        className="absolute -bottom-32 -left-40 h-80 w-80 opacity-8"
      >
        <motion.div
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 160, repeat: Infinity, ease: "linear", delay: 1.5 }}
          className="relative h-full w-full"
        >
          <Image
            src="/background-svg/hammer-svgrepo-com.svg"
            alt=""
            fill
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{
          opacity: { duration: 2, delay: 1, ease: "easeOut" },
          scale: { duration: 2, delay: 1, ease: "easeOut" },
        }}
        className="absolute top-1/3 left-16 h-64 w-64 opacity-6"
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 200, repeat: Infinity, ease: "linear", delay: 2 }}
          className="relative h-full w-full"
        >
          <Image
            src="/background-svg/screwdriver-svgrepo-com.svg"
            alt=""
            fill
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      {/* Additional smaller tools */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 0.15, x: 0 }}
        transition={{
          opacity: { duration: 2, delay: 1.5, ease: "easeOut" },
          x: { duration: 2, delay: 1.5, ease: "easeOut" },
        }}
        className="absolute bottom-1/3 right-20 h-48 w-48 opacity-6"
      >
        <motion.div
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 180, repeat: Infinity, ease: "linear", delay: 3 }}
          className="relative h-full w-full"
        >
          <Image
            src="/background-svg/pliers-svgrepo-com.svg"
            alt=""
            fill
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 0.15, x: 0 }}
        transition={{
          opacity: { duration: 2, delay: 2, ease: "easeOut" },
          x: { duration: 2, delay: 2, ease: "easeOut" },
        }}
        className="absolute top-20 left-1/3 h-32 w-32 opacity-6"
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 220, repeat: Infinity, ease: "linear", delay: 4 }}
          className="relative h-full w-full"
        >
          <Image
            src="/background-svg/ruler-svgrepo-com.svg"
            alt=""
            fill
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      {/* Center bottom tool moved right 30% */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 0.15, y: 0 }}
        transition={{
          opacity: { duration: 2.5, delay: 2.5, ease: "easeOut" },
          y: { duration: 2.5, delay: 2.5, ease: "easeOut" },
        }}
        className="absolute -bottom-20 right-1/3 h-56 w-56 opacity-7"
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 190, repeat: Infinity, ease: "linear", delay: 5 }}
          className="relative h-full w-full"
        >
          <Image
            src="/background-svg/shovel-svgrepo-com.svg"
            alt=""
            fill
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{
          opacity: { duration: 2.5, delay: 1.8, ease: "easeOut" },
          scale: { duration: 2.5, delay: 1.8, ease: "easeOut" },
        }}
        className="absolute top-2/3 right-1/4 h-40 w-40 opacity-6"
      >
        <motion.div
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 170, repeat: Infinity, ease: "linear", delay: 3.5 }}
          className="relative h-full w-full"
        >
          <Image
            src="/background-svg/level-construction-svgrepo-com.svg"
            alt=""
            fill
            className="object-contain"
          />
        </motion.div>
      </motion.div>

      {/* Enhanced primary-colored mesh gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(var(--primary)/0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,hsl(var(--primary)/0.08),transparent_60%)]" />
    </div>
  );
}
