import "../styles/globals.css";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import Layout from '../components/layout/Layout';
import { ToastProvider } from '../contexts/ToastContext';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class">
        <ToastProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}