"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Home, Palette, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="text-center">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="flex justify-center mb-6 md:mb-8 lg:mb-10"
      >
        {/* Logo placeholder - you can add your logo here */}
        <div className="text-primary text-4xl md:text-5xl lg:text-6xl font-display">
          Avorino
        </div>
      </motion.div>

      <div className="inline-block mb-3 md:mb-4 lg:mb-6">
        <div className="px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs md:text-sm font-medium">
          AI-Powered ADU Design Tool
        </div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-foreground mb-3 md:mb-4 lg:mb-6 font-display leading-tight px-2"
      >
        Design & Visualize Your
        <span className="block mt-1 md:mt-2 bg-gradient-to-r from-primary via-primary to-primary/90 bg-clip-text text-transparent">
          Dream ADU
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto font-body px-4 mb-8 md:mb-12 lg:mb-16 leading-relaxed"
      >
        Create your perfect Accessory Dwelling Unit with our interactive 2D floor planner,
        choose custom finishes, and see it come to life with AI-powered 3D visualization.
      </motion.p>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="mb-16 md:mb-20 lg:mb-24"
      >
        <Button
          size="lg"
          onClick={() => window.location.href = '/create/floorplan'}
          className="h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 group"
        >
          Start Designing
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </motion.div>

      {/* Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto px-4"
      >
        {/* Feature 1: Floor Planning */}
        <div className="surface rounded-lg p-6 md:p-8 card-elevated">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Home className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <h3 className="text-lg md:text-xl font-display text-foreground mb-3">
            2D Floor Planning
          </h3>
          <p className="text-sm md:text-base text-muted-foreground font-body leading-relaxed">
            Design your ADU layout with our intuitive drag-and-drop floor planner.
            Create rooms, add walls, and perfect your space.
          </p>
        </div>

        {/* Feature 2: Finish Selection */}
        <div className="surface rounded-lg p-6 md:p-8 card-elevated">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Palette className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <h3 className="text-lg md:text-xl font-display text-foreground mb-3">
            Custom Finishes
          </h3>
          <p className="text-sm md:text-base text-muted-foreground font-body leading-relaxed">
            Choose from premium materials, colors, and finishes.
            Customize every detail to match your vision.
          </p>
        </div>

        {/* Feature 3: 3D Visualization */}
        <div className="surface rounded-lg p-6 md:p-8 card-elevated border-accent-top">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <h3 className="text-lg md:text-xl font-display text-foreground mb-3">
            AI 3D Rendering
          </h3>
          <p className="text-sm md:text-base text-muted-foreground font-body leading-relaxed">
            See your ADU come to life with photorealistic AI-generated 3D visualizations.
            Multiple angles included.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
