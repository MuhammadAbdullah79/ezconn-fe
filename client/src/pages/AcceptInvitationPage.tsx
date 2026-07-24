import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../lib/queryClient';
import { toast } from '../hooks/use-toast';

const AcceptInvitationPage: React.FC = () => {
  const [invitationId, setInvitationId] = useState('');
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('invitation_id') || '';
    setInvitationId(id);
    if (!id) {
      setStatus('invalid');
      return;
    }
    apiRequest('POST', '/auth/validate-invitation', { invitation_id: id })
      .then((res) => res.json())
      .then((data: any) => {
        setEmail(data?.member?.email || '');
        setFirstName(data?.member?.first_name || '');
        setStatus('valid');
      })
      .catch(() => setStatus('invalid'));
  }, []);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password !== rePassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/auth/accept-invitation', {
        invitation_id: invitationId,
        first_name: firstName,
        last_name: lastName,
        password,
        re_password: rePassword,
      });
      toast({
        title: 'Password set',
        description: 'You can now log in.',
      });
      navigate('/login');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          {status === 'loading' && (
            <div className="text-center text-muted-foreground">Checking your invitation…</div>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold text-primary">Invalid invitation</h1>
              <p className="text-muted-foreground">
                This invitation link is invalid or has already been used.
              </p>
              <a href="/login" className="text-sm text-primary font-semibold hover:underline">
                &lt; Back to login
              </a>
            </div>
          )}

          {status === 'valid' && (
            <>
              <div className="text-center">
                <h1 className="text-4xl font-bold text-primary">Set your password</h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  For <span className="font-semibold text-foreground">{email}</span> to activate this login.
                </p>
              </div>

              <form onSubmit={handleAccept} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
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
                  <Label htmlFor="rePassword">Confirm Password</Label>
                  <Input
                    id="rePassword"
                    type={showPassword ? 'text' : 'password'}
                    value={rePassword}
                    onChange={(e) => setRePassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={8}
                  />
                  {errorMessage && (
                    <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Activating…' : 'Set password & activate'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
        <span>*Illustrations Here*</span>
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
