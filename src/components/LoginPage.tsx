import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, Phone, Loader2, ArrowLeft } from 'lucide-react';

export function LoginPage() {
  const {
    signInWithGoogle,
    sendVerificationCode,
    confirmVerificationCode,
    phoneAuthError,
    phoneAuthLoading,
    clearPhoneAuthError
  } = useAuth();

  const [authMode, setAuthMode] = useState<'choose' | 'phone' | 'verify'>('choose');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendVerificationCode(phoneNumber);
    if (success) {
      setAuthMode('verify');
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await confirmVerificationCode(verificationCode);
  };

  const handleBack = () => {
    setAuthMode('choose');
    setPhoneNumber('');
    setVerificationCode('');
    clearPhoneAuthError();
  };

  const formatPhoneInput = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Home className="h-6 w-6 text-zinc-600" />
          </div>
          <CardTitle className="text-xl">Household Bills</CardTitle>
          <CardDescription>
            {authMode === 'choose' && 'Sign in to manage your family\'s expenses'}
            {authMode === 'phone' && 'Enter your phone number'}
            {authMode === 'verify' && 'Enter the verification code'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Choose auth method */}
          {authMode === 'choose' && (
            <>
              <Button
                onClick={signInWithGoogle}
                variant="outline"
                className="w-full gap-2"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                onClick={() => setAuthMode('phone')}
                variant="outline"
                className="w-full gap-2"
              >
                <Phone className="h-4 w-4" />
                Sign in with Phone
              </Button>
            </>
          )}

          {/* Phone number input */}
          {authMode === 'phone' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatPhoneInput(e.target.value))}
                  disabled={phoneAuthLoading}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  US numbers only. We'll send a verification code via SMS.
                </p>
              </div>

              {phoneAuthError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  {phoneAuthError}
                </div>
              )}

              <Button
                id="phone-sign-in-button"
                type="submit"
                className="w-full"
                disabled={phoneAuthLoading || phoneNumber.replace(/\D/g, '').length < 10}
              >
                {phoneAuthLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </form>
          )}

          {/* Verification code input */}
          {authMode === 'verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={phoneAuthLoading}
                  autoFocus
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to {phoneNumber}
                </p>
              </div>

              {phoneAuthError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  {phoneAuthError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={phoneAuthLoading || verificationCode.length !== 6}
              >
                {phoneAuthLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sign In'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Use different number
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
