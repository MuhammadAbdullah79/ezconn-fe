import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSite } from '../contexts/SiteContext';
import { apiRequest } from '../lib/queryClient';

// apiRequest throws `Error("401: {\"message\":\"Invalid credentials\",...}")`.
// Pull a clean, human-readable message out of it — no status code, no raw JSON.
const extractErrorMessage = (error: any): string => {
  const raw = String(error?.message ?? '');
  const body = raw.replace(/^\d+:\s*/, '').trim();
  let serverMsg = body;
  try {
    const parsed = JSON.parse(body);
    serverMsg = parsed?.message || parsed?.error || body;
  } catch {
    // body wasn't JSON — use it as-is
  }
  if (/invalid credentials/i.test(serverMsg)) return 'Invalid email or password';
  if (!serverMsg || /^\s*$/.test(serverMsg) || /failed to fetch/i.test(serverMsg)) {
    return 'Could not connect to the server. Please try again.';
  }
  return serverMsg;
};

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { siteData } = useSite();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await apiRequest('POST', '/auth/login', { email, password });
      
      const data = await response.json();
      // Save token and user info
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.user));
      
      // Navigate based on backend response or role
      if (data.redirect_to) {
        navigate(data.redirect_to);
      } else if (data.user?.role === 'AGENCY' || data.user?.role === 'agency') {
        navigate('/agency');
      } else {
        // Redirect workspace users to root for better layout stability
        navigate('/');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Section */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-primary">Welcome to</h1>
            <h1 className="text-4xl font-bold text-primary">EZCONN!</h1>
            <p className="mt-4 text-lg text-muted-foreground">Login into your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-primary"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            
              <div className="flex items-center gap-3 mt-1">
                {error && (
                  <span role="alert" className="text-sm text-destructive">
                    {error}
                  </span>
                )}
                <a
                  href="/forgot-password"
                  className="ml-auto text-sm text-primary hover:underline whitespace-nowrap"
                >
                  Forgot Password?
                </a>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-lg text-sm font-semibold shadow-sm transition-colors mt-1"
            >
              Login
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground pt-8">
            <p>&copy; 2025 EZCONN. <a href="https://ezauq.com/privacy-and-policy" target='_blank' rel="noopener noreferrer" className="hover:underline text-primary">Privacy Policy</a> | <a href="https://ezauq.com/terms-of-service" target='_blank' rel="noopener noreferrer" className="hover:underline text-primary">Terms of Service</a></p>
          </div>
        </div>
      </div>

      {/* Right Section - Gradient with Text */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
        <span>*Illustrations Here*</span>
      </div>
    </div>
  );
};

export default LoginPage;
