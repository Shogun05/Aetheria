import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import './styles/globals.css';
import { wagmiConfig } from './lib/wagmi';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Featured from './pages/Featured';
import Upload from './pages/Upload';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ArtDetail from './pages/ArtDetail';
import Marketplace from './pages/Marketplace';
import Help from './pages/Help';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import NavBar from './components/NavBar';
import Toasts from './components/Toasts';
import AnimatedBackground from './components/AnimatedBackground';

const queryClient = new QueryClient();

function AppShell() {
  return (
    <div className="min-h-screen bg-base">
      <AnimatedBackground />
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/featured" element={<Featured />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/art/:id" element={<ArtDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/help" element={<Help />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Toasts />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#7cf7f0',
            accentColorForeground: '#0b0d10',
            overlayBlur: 'small'
          })}
          modalSize="compact"
        >
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </RainbowKitProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
