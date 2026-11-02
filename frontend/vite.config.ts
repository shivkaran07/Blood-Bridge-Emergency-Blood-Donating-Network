import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    sourcemap: false,
    // Split vendor chunks to keep the initial entry bundle below the 500 kB
    // Rollup warning threshold. Heavy third-party dependencies are placed in
    // named chunks so they can be cached independently.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Supabase client and its deep transitive dependencies
          if (id.includes('@supabase/')) return 'supabase';
          // ethers.js — only needed on the blockchain page
          if (id.includes('ethers') || id.includes('@ethersproject')) return 'ethers';
          // React core (react, react-dom, react-router-dom, scheduler)
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) return 'react-core';
          // TanStack Query
          if (id.includes('@tanstack/')) return 'tanstack';
          // React Router
          if (id.includes('react-router')) return 'react-router';
          // Lucide icons — large icon set
          if (id.includes('lucide-react')) return 'icons';
          // React Hook Form + Zod
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms';
        },
      },
    },
  },
});
