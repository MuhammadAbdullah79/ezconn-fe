import React from 'react';
import { CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAvatarColor } from '@/lib/avatar-utils';
import { getUserInfo } from '@/lib/auth';

interface ProfileSectionProps {
  profilePictureUrl: string;
  setProfilePictureUrl: (url: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  browserNotificationsDenied: boolean;
  handleTestNotification: () => void;
}

const ProfileSection = ({
  profilePictureUrl,
  setProfilePictureUrl,
  notificationsEnabled,
  setNotificationsEnabled,
  browserNotificationsDenied,
  handleTestNotification,
}: ProfileSectionProps) => {
  const { toast } = useToast();
  const u = getUserInfo();
  const displayName =
    (u.full_name && String(u.full_name).trim()) ||
    `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
    (u.email ? String(u.email).split('@')[0] : 'User');
  const displayEmail = u.email || '—';
  const initials = displayName
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <>
      <CardHeader>
        <CardTitle className="text-lg">My Profile</CardTitle>
        <p className="text-sm text-muted-foreground">Customize your account profile.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Separator />
        {/* Profile Info */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profilePictureUrl && profilePictureUrl !== "" ? (
                <img src={profilePictureUrl} alt="Profile" className="rounded-full object-cover" />
              ) : (
                <AvatarFallback className={`${getAvatarColor(displayName)} text-xl`}>{initials}</AvatarFallback>
              )}
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{displayName}</p>
              <p className="text-sm text-muted-foreground">{displayEmail}</p>
            </div>
          </div>
          <input
            type="file"
            id="profile-picture-upload"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setProfilePictureUrl(URL.createObjectURL(e.target.files[0]));
                toast({
                  title: "Profile Picture Updated",
                  description: "Your profile picture has been successfully updated.",
                });
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('profile-picture-upload')?.click()}
            className="btn-outline-primary h-7 text-xs"
          >
            Change Photo
          </Button>
        </div>

        <Separator />

        {/* Details */}
        <div className="space-y-3">
          <div className="flex items-center">
            <p className="text-sm font-medium text-foreground pr-1.5">Role:</p>
            <p className="text-sm text-muted-foreground">Administrator</p>
          </div>
          <div className="flex items-center">
            <p className="text-sm font-medium text-foreground pr-1.5">Team:</p>
            <p className="text-sm text-muted-foreground">No team assigned</p>
          </div>
          <div className="flex items-center">
            <p className="text-sm font-medium text-foreground pr-1.5">Timezone:</p>
            <p className="text-sm text-muted-foreground">(GMT+05:00) Islamabad, Karachi, Tashkent</p>
          </div>
        </div>

        <Separator />

        {/* Notifications */}
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Notifications</h4>
          <p className="text-sm text-muted-foreground">Show desktop notifications for incoming conversations. You will need to configure your browser settings to allow notifications from us.</p>
          {browserNotificationsDenied && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              You have actively denied notifications. Please update your browser notification settings.
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Enable Desktop Notifications</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!notificationsEnabled || browserNotificationsDenied}
                onClick={handleTestNotification}
                className="btn-outline-primary h-7 text-xs"
              >
                Test
              </Button>
              <Switch
                aria-label="Enable Desktop Notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
                disabled={browserNotificationsDenied}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          onClick={() => {
            console.log("Save My Profile");
            toast({
              title: "Profile Saved",
              description: "Your profile settings have been updated.",
            });
          }}
          className="btn-outline-primary font-normal"
          variant="outline"
        >
          Save
        </Button>
      </CardFooter>
    </>
  );
};

export default ProfileSection;
