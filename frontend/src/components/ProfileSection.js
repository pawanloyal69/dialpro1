import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { User, LogOut, FileText, Shield, Info, Download } from 'lucide-react';
import { useAuth } from '../api/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ProfileSection = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <Card data-testid="profile-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Info */}
        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
            <p className="font-medium" data-testid="user-name">{user?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
            <p className="font-medium font-mono" data-testid="user-phone">{user?.phone_number}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
            <p className="font-medium" data-testid="user-email">{user?.email}</p>
          </div>
          {user?.role === 'admin' && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Role</p>
              <p className="font-medium text-primary">Administrator</p>
            </div>
          )}
        </div>

        {/* Legal Links */}
        <div className="border-t pt-4 space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            size="sm"
            onClick={() => navigate('/privacy-policy')}
            data-testid="privacy-policy-link"
          >
            <FileText className="w-4 h-4 mr-2" />
            Privacy Policy
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            size="sm"
            onClick={() => navigate('/terms')}
            data-testid="terms-link"
          >
            <Shield className="w-4 h-4 mr-2" />
            Terms & Conditions
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start" 
            size="sm"
            onClick={() => navigate('/about')}
            data-testid="about-link"
          >
            <Info className="w-4 h-4 mr-2" />
            About Us
          </Button>
        </div>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
          data-testid="logout-button"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>

   {/* Download Android App (Desktop only) */}
<div
  style={{
    display: 'none'
  }}
  className="desktop-only"
>
  <Button
    asChild
    variant="outline"
    className="w-full flex items-center justify-center gap-2"
    data-testid="download-android-app"
  >
    <a href="/dialpro.apk" download>
      <Download className="w-4 h-4" />
      Download Android App
    </a>
  </Button>
</div>

<style>
{`
@media (min-width: 1024px) {
  .desktop-only {
    display: block;
  }
}
`}
</style>




        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t">
          <p>Dial Pro</p>
          <p>Powered by Tech Talk Titan</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSection;
