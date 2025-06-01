import "../styles/globals.css";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import Layout from '../components/layout/Layout';
import { ToastProvider } from '../contexts/ToastContext';
import Head from 'next/head';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class">
        <ToastProvider>
          <Head>
            <title>STEMuiz - Interactive STEM Quizzes for Science, Technology, Engineering & Math</title>
            <meta name="description" content="Create and play interactive quizzes for Science, Technology, Engineering, and Mathematics. Perfect for classrooms, study groups, and STEM enthusiasts." />
            <meta name="keywords" content="STEM quiz, science quiz, technology quiz, engineering quiz, math quiz, educational games, classroom games, interactive learning" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            
            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content="https://stemuiz.vercel.app/" />
            <meta property="og:title" content="STEMuiz - Interactive STEM Quizzes" />
            <meta property="og:description" content="Create and play interactive quizzes for Science, Technology, Engineering, and Mathematics. Perfect for classrooms and STEM enthusiasts." />
            <meta property="og:image" content="https://stemuiz.vercel.app/og-image.png" />
            
            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content="https://stemuiz.vercel.app/" />
            <meta property="twitter:title" content="STEMuiz - Interactive STEM Quizzes" />
            <meta property="twitter:description" content="Create and play interactive quizzes for Science, Technology, Engineering, and Mathematics." />
            <meta property="twitter:image" content="https://stemuiz.vercel.app/og-image.png" />
            
            {/* Canonical URL */}
            <link rel="canonical" href="https://stemuiz.vercel.app/" />
          </Head>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}