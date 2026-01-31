import { ProfileCreationWizard } from '@/app/components/profile/ProfileCreationWizard';

export const metadata = {
  title: 'Set Up Your Profile | Find My Crew',
  description: 'Complete your sailing profile to start finding crew positions or boat owners.',
};

export default function ProfileSetupPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <ProfileCreationWizard />
      </div>
    </div>
  );
}
