import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../lib/queryClient';
import { toast } from '../hooks/use-toast';

const ForgotPasswordPage: React.FC = () => {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [, navigate] = useLocation();

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email) {
      setErrorMessage('Please enter your email');
      return;
    }

    setIsSending(true);
    try {
      await apiRequest('POST', '/auth/forgot-password', { email });
      toast({
        title: 'Code sent',
        description: `A password reset code was sent to ${email}.`,
      });
      setStep('reset');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to send reset code');
    } finally {
      setIsSending(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }

    setIsResetting(true);
    try {
      await apiRequest('POST', '/auth/reset-password', {
        email,
        code,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      toast({
        title: 'Password updated',
        description: 'You can now log in with your new password.',
      });
      navigate('/login');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Section */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          {step === 'email' ? (
            <>
              <div className="text-center">
                <h1 className="text-4xl font-bold text-primary">Forgot Password?</h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Enter your business email and we'll send you a code to reset your password.
                </p>
              </div>

              <form onSubmit={handleSendResetLink} className="space-y-4">
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
                  {errorMessage && (
                    <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSending}>
                  {isSending ? 'Sending…' : 'Send reset code'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-4xl font-bold text-primary">Reset Password</h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Enter the code sent to <span className="font-semibold text-foreground">{email}</span> and choose a new password.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="code">Reset code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="mt-1"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-primary"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="mt-1"
                  />
                  {errorMessage && (
                    <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isResetting}>
                  {isResetting ? 'Resetting…' : 'Reset password'}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  &lt; Use a different email
                </button>
              </div>
            </>
          )}

          <div className="text-center">
            <a href="/login" className="text-sm text-primary font-semibold hover:underline">
              &lt; Back to login
            </a>
          </div>

          <div className="text-center text-sm text-muted-foreground pt-8">
            <p>&copy; 2025 EZCONN. <a href="https://ezauq.com/privacy-and-policy" target='_blank' rel="noopener noreferrer" className="hover:underline text-primary">Privacy Policy</a> | <a href="https://ezauq.com/terms-of-service" target='_blank' rel="noopener noreferrer" className="hover:underline text-primary">Terms of Service</a></p>
          </div>
        </div>
      </div>

      {/* Right Section - Gradient with Text */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-green-400 to-blue-500 text-white text-2xl font-bold">
        <span>*Illustrations Here*</span>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
