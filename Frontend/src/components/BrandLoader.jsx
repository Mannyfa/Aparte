import React from 'react';
import { motion } from 'framer-motion';

export default function BrandLoader() {
  const letters = "APARTEY".split("");

  return (
    <div className="flex flex-col justify-center items-center py-32 w-full h-full min-h-[40vh]">
      <div className="flex items-center gap-1 md:gap-2">
        {letters.map((letter, index) => (
          <motion.span
            key={index}
            className="font-display font-extrabold text-3xl md:text-5xl"
            // We animate the opacity, color (Brand to Gold to Brand), and a slight upward bounce
            animate={{ 
              opacity: [0.3, 1, 0.3],
              color: ['#0f172a', '#d4af37', '#0f172a'], 
              y: [0, -10, 0]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.15 // This is the magic that creates the spelling wave!
            }}
          >
            {letter}
          </motion.span>
        ))}
      </div>
      
      {/* A subtle pulsing text underneath */}
      <motion.p 
        className="mt-6 text-xs md:text-sm font-bold text-gray-400 tracking-[0.3em] uppercase"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        Curating Luxury...
      </motion.p>
    </div>
  );
}