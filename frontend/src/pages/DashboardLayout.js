import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../api/AuthContext';
import { Phone, MessageSquare, History, Wallet, Settings, Menu, PhoneCall, User, LogOut, ChevronDown, ChevronUp, Crown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { toast } from 'sonner';

import Dialer from '../components/Dialer';
import CallHistory from '../components/CallHistory';
import Messages from '../components/Messages';
import WalletSection from '../components/WalletSection';
import ProfileSection from '../components/ProfileSection';
import NumberManagement from '../components/NumberManagement';
import PlansSection from '../components/PlansSection';
import ConversationsView from '../components/ConversationsView';

// Compact Profile Button Component
const ProfileButton = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between"
          data-testid="profile-toggle"
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="font-medium">{user?.name}</span>
          </div>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 p-3 border rounded-lg bg-white dark:bg-slate-800 space-y-2">
        <div className="text-sm space-y-1">
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">Email:</span> {user?.email}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">Phone:</span> {user?.phone_number}
          </p>
          {user?.role === 'admin' && (
            <p className="text-primary font-medium">Administrator</p>
          )}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => navigate('/privacy-policy')}
          >
            Privacy
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => navigate('/terms')}
          >
            Terms
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => navigate('/about')}
          >
            About
          </Button>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={handleLogout}
          data-testid="logout-button"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};

const DashboardLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { path: '/', icon: Phone, label: 'Dialer', testId: 'nav-dialer' },
    { path: '/numbers', icon: PhoneCall, label: 'Numbers', testId: 'nav-numbers' },
    { path: '/plans', icon: Crown, label: 'Plans', testId: 'nav-plans' },
    { path: '/messages', icon: MessageSquare, label: 'Messages', testId: 'nav-messages' },
    { path: '/wallet', icon: Wallet, label: 'Wallet', testId: 'nav-wallet' },
  ];

  // Desktop Layout (3-column) - optimized to fit without scrolling
  if (!isMobile) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden" data-testid="desktop-dashboard">
        <div className="grid grid-cols-12 gap-4 p-4 h-full max-w-[1800px] mx-auto">
          {/* Left Column - Dialer */}
          <div className="col-span-3 flex flex-col gap-4 overflow-auto">
            <Dialer />
          </div>

          {/* Center Column - Conversations (SMS, Calls, Voicemails) */}
          <div className="col-span-5 h-full flex flex-col min-h-0">
            <ConversationsView />
          </div>

          {/* Right Column - Profile (collapsed), Wallet, Plans, Numbers */}
          <div className="col-span-4 flex flex-col gap-3 overflow-auto">
            {/* Collapsed Profile */}
            <ProfileButton />
            
            {/* Wallet Section - Compact */}
            <WalletSection />
            
            {/* Plans Section */}
            <PlansSection />
            
            {/* Numbers Section */}
            <NumberManagement />
          </div>
        </div>
      </div>
    );
  }

  // Mobile Layout (Full screen with bottom nav)
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20" data-testid="mobile-dashboard">
      {/* Mobile Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Dial Pro</h1>
          <ProfileButton />
        </div>
      </div>

      {/* Mobile Content */}
      <div className="p-4 h-[calc(100vh-140px)] overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dialer />} />
          <Route path="/messages" element={<ConversationsView />} />
          <Route path="/wallet" element={<WalletSection />} />
          <Route path="/numbers" element={<NumberManagement />} />
          <Route path="/plans" element={<PlansSection />} />
        </Routes>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 z-20" data-testid="bottom-nav">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                data-testid={item.testId}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-gray-600 dark:text-gray-400 hover:text-primary'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
