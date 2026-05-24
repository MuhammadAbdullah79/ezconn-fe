import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSite } from '../contexts/SiteContext';
import { apiRequest } from '../lib/queryClient';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { siteData } = useSite();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/auth/login', { email, password });

      const data = await response.json();
      // Save token and user info
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_info", JSON.stringify(data.user));

      setSuccessMessage('Login successful');

      // Trigger the "curtain opening" animation: the two panels slide apart,
      // then we navigate once the animation has played.
      setIsOpening(true);

      setTimeout(() => {
        if (data.redirect_to) {
          navigate(data.redirect_to);
        } else if (data.user?.role === 'AGENCY' || data.user?.role === 'agency') {
          navigate('/agency');
        } else {
          // Redirect workspace users to root for better layout stability
          navigate('/');
        }
      }, 550);
    } catch (error: any) {
      console.error('Login error:', error);
      const msg = String(error?.message ?? '');
      const isInvalidCreds = msg.includes('401') || /invalid credentials/i.test(msg) || /unauthorized/i.test(msg);
      setErrorMessage(isInvalidCreds ? 'Incorrect Password' : (msg || 'Failed to connect to the server.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Section — slides left like a curtain on successful login */}
      <div
        className={cn(
          "flex-1 flex items-center justify-center p-8 bg-background z-10 transition-transform duration-500 ease-in-out",
          isOpening && "-translate-x-full"
        )}
      >
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
                onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
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
              {errorMessage && (
                <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="mt-1 text-sm text-green-600">{successMessage}</p>
              )}

              <div className="text-right mt-1">
                <a href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot Password?
                </a>
              </div>
            </div>


            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in…' : 'Login'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground pt-8">
            <p>&copy; 2025 EZCONN. <a href="https://ezauq.com/privacy-and-policy" target='_blank' rel="noopener noreferrer" className="hover:underline text-primary">Privacy Policy</a> | <a href="https://ezauq.com/terms-of-service" target='_blank' rel="noopener noreferrer" className="hover:underline text-primary">Terms of Service</a></p>
          </div>
        </div>
      </div>

      {/* Right Section — slides right like a curtain on successful login */}
      <div
        className={cn(
          "hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold z-10 transition-transform duration-500 ease-in-out",
          isOpening && "translate-x-full"
        )}
      >
        <span>*Illustrations Here*</span>
      </div>
    </div>
  );
};

export default LoginPage;
